package domain

// RuleViolation is a business rule refused by the domain. It carries the stable rule identifier so
// the API can explain *why* an operation was declined without inventing a message at the boundary
// (HHR-DOM-014).
type RuleViolation struct {
	Rule    string
	Message string
}

func (v *RuleViolation) Error() string {
	if v.Rule == "" {
		return v.Message
	}
	return v.Rule + ": " + v.Message
}
