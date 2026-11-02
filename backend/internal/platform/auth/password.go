// Package auth implements the local credential provider, server-side sessions and the caller
// identity every request carries. The platform owns authentication; applications never do.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// ErrInvalidHash means a stored hash is malformed. A malformed hash must never authenticate
// anybody, and the reason is never disclosed to the caller.
var ErrInvalidHash = errors.New("invalid password hash")

// ARGON2 parameters: OWASP's interactive recommendation (19 MiB, 2 iterations, 1 lane). They are
// encoded in every hash, so raising them later still verifies existing credentials.
const (
	argonMemory      = 19 * 1024
	argonIterations  = 2
	argonParallelism = 1
	argonSaltLength  = 16
	argonKeyLength   = 32
)

// PasswordHasher hashes and verifies passwords.
type PasswordHasher interface {
	Hash(plain string) (string, error)
	Verify(encodedHash, plain string) (bool, error)
}

// Argon2id is the production hasher.
type Argon2id struct{}

// Hash returns a PHC-formatted argon2id hash.
func (Argon2id) Hash(plain string) (string, error) {
	salt := make([]byte, argonSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("read salt: %w", err)
	}
	key := argon2.IDKey([]byte(plain), salt, argonIterations, argonMemory, argonParallelism, argonKeyLength)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		argonMemory,
		argonIterations,
		argonParallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// Verify checks a password against a PHC-formatted hash. It accepts the parameters encoded in the
// hash, so hashes created with older settings remain valid.
func (Argon2id) Verify(encodedHash, plain string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return false, ErrInvalidHash
	}
	if parts[2] != fmt.Sprintf("v=%d", argon2.Version) {
		return false, ErrInvalidHash
	}
	var memory uint32
	var iterations uint32
	var parallelism uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism); err != nil {
		return false, ErrInvalidHash
	}
	if memory < 8*1024 || memory > 1024*1024 || iterations < 1 || iterations > 10 || parallelism < 1 || parallelism > 16 {
		return false, ErrInvalidHash
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 8 {
		return false, ErrInvalidHash
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(want) == 0 {
		return false, ErrInvalidHash
	}
	got := argon2.IDKey([]byte(plain), salt, iterations, memory, parallelism, uint32(len(want)))
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// HashToken stores only a SHA-256 digest of a session token, so a database read cannot be
// replayed as a credential (SEC-009).
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// newSessionToken returns 32 bytes of entropy encoded as base64url.
func newSessionToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("read session token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// dummyHash is a real argon2id hash of a random password nobody knows. It is generated at start-up
// rather than hard-coded so it can never become a usable credential, and it makes the work done for
// an unknown account indistinguishable from the work done for a known one (SEC-011).
var dummyHash = func() string {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	encoded, err := Argon2id{}.Hash(base64.RawURLEncoding.EncodeToString(raw))
	if err != nil {
		panic(fmt.Sprintf("build dummy hash: %v", err))
	}
	return encoded
}()

// verifyDummy performs the same KDF work as a real verification.
func verifyDummy(hasher PasswordHasher, password string) {
	_, _ = hasher.Verify(dummyHash, password)
}
