// Package clock makes time injectable so domain rules and tests agree on "today".
package clock

import "time"

// Clock is the only source of the current instant in application code.
type Clock interface {
	Now() time.Time
	Today(location string) string
}

// System is the production clock.
type System struct{}

// Now returns the current instant.
func (System) Now() time.Time { return time.Now().UTC() }

// Today returns the organization's local calendar date as YYYY-MM-DD. Business dates are
// date-only values: a server or device time zone must never shift a calendar day (BIZ-010).
func (System) Today(location string) string {
	zone, err := time.LoadLocation(location)
	if err != nil {
		zone = time.UTC
	}
	return time.Now().In(zone).Format("2006-01-02")
}

// Fixed is a test clock.
type Fixed struct {
	Instant time.Time
	Date    string
}

// Now returns the fixed instant.
func (f Fixed) Now() time.Time { return f.Instant }

// Today returns the fixed business date.
func (f Fixed) Today(string) string { return f.Date }
