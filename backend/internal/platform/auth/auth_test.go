package auth_test

import (
	"strings"
	"testing"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
)

func TestArgon2id_HashAndVerify(t *testing.T) {
	hasher := auth.Argon2id{}
	password := "SecretP@ssw0rd-2026"

	hash, err := hasher.Hash(password)
	if err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	if !strings.HasPrefix(hash, "$argon2id$") {
		t.Fatalf("expected argon2id PHC prefix, got: %s", hash)
	}

	// Verify correct password
	match, err := hasher.Verify(hash, password)
	if err != nil {
		t.Fatalf("verify returned error: %v", err)
	}
	if !match {
		t.Errorf("expected password to verify successfully")
	}

	// Verify incorrect password
	matchWrong, err := hasher.Verify(hash, "WrongPassword")
	if err != nil {
		t.Fatalf("verify returned error on wrong password: %v", err)
	}
	if matchWrong {
		t.Errorf("expected wrong password to fail verification")
	}
}

func TestActor_PermissionAndScopeChecks(t *testing.T) {
	actor := auth.Actor{
		AccountID:      "acc_123",
		OrganizationID: "org_456",
		Email:          "hr@example.com",
		Grants: []auth.Grant{
			{Permission: "hr.employee.read", Scope: auth.ScopeSubtree},
			{Permission: "hr.organization.read", Scope: auth.ScopeAll},
		},
	}

	if !actor.Can("hr.employee.read") {
		t.Errorf("expected actor to have hr.employee.read permission")
	}

	if actor.Can("hr.employee.create") {
		t.Errorf("expected actor NOT to have hr.employee.create permission")
	}

	scope, ok := actor.ScopeFor("hr.employee.read")
	if !ok || scope != auth.ScopeSubtree {
		t.Errorf("expected scope subtree, got %s (ok=%v)", scope, ok)
	}

	_, ok = actor.ScopeFor("unknown.permission")
	if ok {
		t.Errorf("expected false for unknown permission")
	}
}
