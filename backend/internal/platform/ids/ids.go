// Package ids creates identifiers without a third-party dependency.
package ids

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// New returns a random RFC 4122 version 4 UUID.
func New() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		// crypto/rand failing means the process cannot safely mint session tokens or identifiers.
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	raw[6] = (raw[6] & 0x0f) | 0x40
	raw[8] = (raw[8] & 0x3f) | 0x80
	var out [36]byte
	hex.Encode(out[0:8], raw[0:4])
	out[8] = '-'
	hex.Encode(out[9:13], raw[4:6])
	out[13] = '-'
	hex.Encode(out[14:18], raw[6:8])
	out[18] = '-'
	hex.Encode(out[19:23], raw[8:10])
	out[23] = '-'
	hex.Encode(out[24:36], raw[10:16])
	return string(out[:])
}
