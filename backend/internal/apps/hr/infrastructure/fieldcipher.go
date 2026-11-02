// Package infrastructure contains the H-HR adapters: PostgreSQL repositories, the field cipher and
// the connection to platform services. Nothing here is imported by the domain.
package infrastructure

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

// FieldCipher protects identity numbers, passports and bank identifiers (SEC-008).
//
// Values are encrypted with AES-256-GCM using a key from the environment. A separate deterministic
// HMAC over the normalised value allows duplicate detection without ever decrypting anything.
type FieldCipher struct {
	aead      cipher.AEAD
	lookupKey []byte
	ephemeral bool
}

const (
	cipherVersion = "v1"
	cipherIVBytes = 12
	cipherKeySize = 32
)

// ErrCipherNotConfigured is returned when a cipher has no key. It should be unreachable at runtime:
// development and test get an ephemeral key so behaviour matches production.
var ErrCipherNotConfigured = errors.New("field encryption key is not configured")

// NewFieldCipher builds the cipher. An empty key generates a process-local key for development and
// test only; values encrypted with it cannot be read after a restart, which surfaces immediately as
// a decryption failure rather than as a silent security downgrade. Production requires an explicit
// key, and configuration validation refuses to start without one.
func NewFieldCipher(key []byte) (*FieldCipher, error) {
	ephemeral := false
	if len(key) == 0 {
		generated := make([]byte, cipherKeySize)
		if _, err := rand.Read(generated); err != nil {
			return nil, fmt.Errorf("generate ephemeral field key: %w", err)
		}
		key = generated
		ephemeral = true
	}
	if len(key) != cipherKeySize {
		return nil, fmt.Errorf("field encryption key must be %d bytes, got %d", cipherKeySize, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create AES block: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create GCM: %w", err)
	}
	// Derivation is deterministic so the lookup hash is stable across restarts.
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("h-os:field-lookup:v1"))
	return &FieldCipher{aead: aead, lookupKey: mac.Sum(nil), ephemeral: ephemeral}, nil
}

// Ephemeral reports whether the cipher is using a generated development key.
func (c *FieldCipher) Ephemeral() bool { return c.ephemeral }

// Encrypt returns `v1.<iv>.<tag>.<ciphertext>`, every segment base64url without padding.
func (c *FieldCipher) Encrypt(plain string) (string, error) {
	iv := make([]byte, cipherIVBytes)
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("read nonce: %w", err)
	}
	sealed := c.aead.Seal(nil, iv, []byte(plain), nil)
	// Go appends the tag to the ciphertext; split it so the wire format carries them separately and
	// stays compatible with the documented shape.
	tagSize := c.aead.Overhead()
	body, tag := sealed[:len(sealed)-tagSize], sealed[len(sealed)-tagSize:]
	return strings.Join([]string{
		cipherVersion,
		base64.RawURLEncoding.EncodeToString(iv),
		base64.RawURLEncoding.EncodeToString(tag),
		base64.RawURLEncoding.EncodeToString(body),
	}, "."), nil
}

// Decrypt reverses Encrypt and authenticates the payload.
func (c *FieldCipher) Decrypt(payload string) (string, error) {
	parts := strings.Split(payload, ".")
	if len(parts) != 4 || parts[0] != cipherVersion {
		return "", errors.New("unsupported encrypted field format")
	}
	iv, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", errors.New("malformed encrypted field")
	}
	tag, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", errors.New("malformed encrypted field")
	}
	body, err := base64.RawURLEncoding.DecodeString(parts[3])
	if err != nil {
		return "", errors.New("malformed encrypted field")
	}
	sealed := append(append([]byte(nil), body...), tag...)
	plain, err := c.aead.Open(nil, iv, sealed, nil)
	if err != nil {
		return "", errors.New("encrypted field failed authentication")
	}
	return string(plain), nil
}

// LookupHash is a deterministic, non-reversible digest used only for uniqueness checks.
func (c *FieldCipher) LookupHash(plain string) string {
	mac := hmac.New(sha256.New, c.lookupKey)
	mac.Write([]byte(strings.ToLower(strings.TrimSpace(plain))))
	return hex.EncodeToString(mac.Sum(nil))
}
