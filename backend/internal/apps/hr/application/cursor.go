package application

import (
	"encoding/base64"
	"encoding/json"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// cursorEnvelope is the wire shape of a pagination cursor. It is identical to the TypeScript
// encoder, so a cursor minted by the API can be decoded by the client and vice versa.
type cursorEnvelope struct {
	Key string `json:"key"`
	ID  string `json:"id"`
}

// encodeCursor renders a keyset position. Base64url without padding keeps it URL-safe and opaque.
func encodeCursor(cursor Cursor) string {
	encoded, err := json.Marshal(cursorEnvelope{Key: cursor.Key, ID: cursor.ID})
	if err != nil {
		// The envelope only holds two strings, so this cannot fail in practice.
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(encoded)
}

// decodeCursor parses a client-supplied position. A malformed cursor is a validation failure; the
// server never guesses a position from garbage (PERF-003).
func decodeCursor(value string) (*Cursor, error) {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, problem.Validation("The pagination cursor is not valid.")
	}
	var envelope cursorEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, problem.Validation("The pagination cursor is not valid.")
	}
	if envelope.Key == "" || envelope.ID == "" || !IsUUID(envelope.ID) {
		return nil, problem.Validation("The pagination cursor is not valid.")
	}
	return &Cursor{Key: envelope.Key, ID: envelope.ID}, nil
}
