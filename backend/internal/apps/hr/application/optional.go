package application

import "encoding/json"

// Optional distinguishes an absent JSON member from an explicit `null`.
//
// A patch payload needs the difference: `{}` means "change nothing", while `{"city": null}` means
// "clear the city". A plain pointer collapses both into nil and would silently ignore a clear
// instruction. The zero value is "absent", which is why the member must be a value, not a pointer.
type Optional[T any] struct {
	Present bool
	Value   *T
}

// UnmarshalJSON records that the member was present and decodes its value.
func (o *Optional[T]) UnmarshalJSON(data []byte) error {
	o.Present = true
	if string(data) == "null" {
		o.Value = nil
		return nil
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		return err
	}
	o.Value = &value
	return nil
}

// MarshalJSON renders the member as it was read. It exists so a value can round-trip through the
// contract test without inventing a different shape.
func (o Optional[T]) MarshalJSON() ([]byte, error) {
	if o.Value == nil {
		return []byte("null"), nil
	}
	return json.Marshal(*o.Value)
}

// Or returns the current value when the member is absent, and the requested value otherwise.
func Or[T any](optional Optional[T], current T) T {
	if !optional.Present {
		return current
	}
	if optional.Value == nil {
		var zero T
		return zero
	}
	return *optional.Value
}

// OrPointer returns the current pointer when the member is absent. An explicit null clears it.
func OrPointer[T any](optional Optional[T], current *T) *T {
	if !optional.Present {
		return current
	}
	return optional.Value
}
