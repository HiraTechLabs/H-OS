package domain

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// BusinessDate is an ISO-8601 calendar date (`YYYY-MM-DD`). It is a date, never an instant: a
// server or device time zone must not be able to shift a calendar day (BIZ-010).
type BusinessDate string

var businessDatePattern = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})$`)

// IsBusinessDate reports whether value is a real calendar date in ISO form.
func IsBusinessDate(value string) bool {
	match := businessDatePattern.FindStringSubmatch(value)
	if match == nil {
		return false
	}
	year, _ := strconv.Atoi(match[1])
	month, _ := strconv.Atoi(match[2])
	day, _ := strconv.Atoi(match[3])
	date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	return date.Year() == year && int(date.Month()) == month && date.Day() == day
}

// CompareBusinessDates orders two dates: -1, 0 or 1.
func CompareBusinessDates(left, right string) int {
	leftTime, leftOK := parseDate(left)
	rightTime, rightOK := parseDate(right)
	if !leftOK || !rightOK {
		// Invalid input is a programming fault; compare lexically so the result is deterministic
		// rather than silently "equal".
		return strings.Compare(left, right)
	}
	switch {
	case leftTime.Before(rightTime):
		return -1
	case leftTime.After(rightTime):
		return 1
	default:
		return 0
	}
}

// IsBefore reports whether left is strictly earlier than right.
func IsBefore(left, right string) bool { return CompareBusinessDates(left, right) < 0 }

// IsOnOrBefore reports whether left is earlier than or equal to right.
func IsOnOrBefore(left, right string) bool { return CompareBusinessDates(left, right) <= 0 }

// AddDays shifts a business date by whole days, keeping it a date.
func AddDays(value string, days int) string {
	parsed, ok := parseDate(value)
	if !ok {
		return value
	}
	return parsed.AddDate(0, 0, days).Format("2006-01-02")
}

// Range is a half-open business-date range `[From, To)`; a nil To is unbounded.
type Range struct {
	From string
	To   *string
}

// IsValidRange reports whether the range is well formed and non-empty.
func IsValidRange(r Range) bool {
	if !IsBusinessDate(r.From) {
		return false
	}
	if r.To == nil {
		return true
	}
	if !IsBusinessDate(*r.To) {
		return false
	}
	return IsBefore(r.From, *r.To)
}

// RangesOverlap reports whether two half-open ranges share a day. Nil ends are unbounded.
func RangesOverlap(left, right Range) bool {
	if left.To != nil && IsOnOrBefore(*left.To, right.From) {
		return false
	}
	if right.To != nil && IsOnOrBefore(*right.To, left.From) {
		return false
	}
	return true
}

// Contains reports whether the half-open range covers a date.
func (r Range) Contains(date string) bool {
	if IsBefore(date, r.From) {
		return false
	}
	if r.To == nil {
		return true
	}
	return IsBefore(date, *r.To)
}

func parseDate(value string) (time.Time, bool) {
	match := businessDatePattern.FindStringSubmatch(value)
	if match == nil {
		return time.Time{}, false
	}
	year, _ := strconv.Atoi(match[1])
	month, _ := strconv.Atoi(match[2])
	day, _ := strconv.Atoi(match[3])
	date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	if date.Year() != year || int(date.Month()) != month || date.Day() != day {
		return time.Time{}, false
	}
	return date, true
}
