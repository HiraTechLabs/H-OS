package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// EmployeeRepository is the PostgreSQL adapter for employee records.
type EmployeeRepository struct {
	pool *db.Pool
}

// NewEmployeeRepository builds the adapter.
func NewEmployeeRepository(pool *db.Pool) *EmployeeRepository { return &EmployeeRepository{pool: pool} }

// NextEmployeeNumber allocates the next business-facing number for the organization. The upsert is
// one statement, so two concurrent creations cannot receive the same number (BIZ-008).
func (r *EmployeeRepository) NextEmployeeNumber(ctx context.Context, q db.Querier, organizationID string) (string, error) {
	var lastValue int
	err := q.QueryRow(ctx, `
		insert into hr.employee_number_sequence (organization_id, last_value)
		values ($1, 1)
		on conflict (organization_id)
		do update set last_value = hr.employee_number_sequence.last_value + 1
		returning last_value`, organizationID).Scan(&lastValue)
	if err != nil {
		return "", fmt.Errorf("allocate employee number: %w", err)
	}
	return domain.FormatEmployeeNumber(lastValue)
}

// Insert writes the employee, person and contact rows.
func (r *EmployeeRepository) Insert(ctx context.Context, q db.Querier, data application.NewEmployeeData, now time.Time) error {
	if _, err := q.Exec(ctx, `
		insert into hr.employee
			(id, organization_id, employee_number, status, work_email, created_at, updated_at)
		values ($1, $2, $3, $4, $5, $6, $6)`,
		data.ID, data.OrganizationID, data.EmployeeNumber, string(data.Status), data.WorkEmail, now); err != nil {
		return fmt.Errorf("insert employee: %w", err)
	}
	if _, err := q.Exec(ctx, `
		insert into hr.employee_person
			(employee_id, given_name_en, family_name_en, given_name_ar, family_name_ar,
			 date_of_birth, gender, nationality, national_id_ciphertext, national_id_last4,
			 national_id_hash, passport_ciphertext, passport_last4, updated_at)
		values ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14)`,
		data.ID, data.Person.GivenNameEn, data.Person.FamilyNameEn, data.Person.GivenNameAr, data.Person.FamilyNameAr,
		data.Person.DateOfBirth, data.Person.Gender, data.Person.Nationality,
		data.Person.NationalIDCiphertext, data.Person.NationalIDLast4, data.Person.NationalIDHash,
		data.Person.PassportCiphertext, data.Person.PassportLast4, now); err != nil {
		return fmt.Errorf("insert employee person: %w", err)
	}
	if _, err := q.Exec(ctx, `
		insert into hr.employee_contact (employee_id, personal_email, phone, city, updated_at)
		values ($1, $2, $3, $4, $5)`,
		data.ID, data.Contact.PersonalEmail, data.Contact.Phone, data.Contact.City, now); err != nil {
		return fmt.Errorf("insert employee contact: %w", err)
	}
	return nil
}

// FindByID loads one employee aggregate. A missing employee is (nil, nil).
func (r *EmployeeRepository) FindByID(ctx context.Context, employeeID string) (*application.EmployeeAggregate, error) {
	aggregate := application.EmployeeAggregate{
		EmergencyContacts: []application.EmergencyContactRecord{},
		Episodes:          []application.EpisodeRecord{},
		Contracts:         []application.ContractRecord{},
		Assignments:       []application.AssignmentRecord{},
		Managers:          []application.ManagerRecord{},
		Documents:         []application.DocumentRecord{},
	}

	var status string
	err := r.pool.QueryRow(ctx, `
		select id::text, organization_id::text, employee_number, status, work_email, archived_at
		from hr.employee where id = $1`, employeeID).Scan(
		&aggregate.Core.ID, &aggregate.Core.OrganizationID, &aggregate.Core.EmployeeNumber,
		&status, &aggregate.Core.WorkEmail, &aggregate.Core.ArchivedAt)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	aggregate.Core.Status = domain.EmploymentStatus(status)

	if err := r.pool.QueryRow(ctx, `
		select given_name_en, family_name_en, given_name_ar, family_name_ar,
		       date_of_birth::text, gender, nationality, national_id_ciphertext, national_id_last4,
		       national_id_hash, passport_ciphertext, passport_last4
		from hr.employee_person where employee_id = $1`, employeeID).Scan(
		&aggregate.Person.GivenNameEn, &aggregate.Person.FamilyNameEn,
		&aggregate.Person.GivenNameAr, &aggregate.Person.FamilyNameAr,
		&aggregate.Person.DateOfBirth, &aggregate.Person.Gender, &aggregate.Person.Nationality,
		&aggregate.Person.NationalIDCiphertext, &aggregate.Person.NationalIDLast4,
		&aggregate.Person.NationalIDHash, &aggregate.Person.PassportCiphertext,
		&aggregate.Person.PassportLast4); err != nil && !errors.Is(err, db.ErrNoRows) {
		return nil, err
	} else if errors.Is(err, db.ErrNoRows) {
		aggregate.Person.Gender = "undisclosed"
	}

	err = r.pool.QueryRow(ctx, `
		select personal_email, phone, city from hr.employee_contact where employee_id = $1`, employeeID).
		Scan(&aggregate.Contact.PersonalEmail, &aggregate.Contact.Phone, &aggregate.Contact.City)
	if err != nil && !errors.Is(err, db.ErrNoRows) {
		return nil, err
	}

	if err := r.loadEmergencyContacts(ctx, employeeID, &aggregate); err != nil {
		return nil, err
	}
	if err := r.loadEmployment(ctx, employeeID, &aggregate); err != nil {
		return nil, err
	}
	if err := r.loadAssignments(ctx, employeeID, &aggregate); err != nil {
		return nil, err
	}
	if err := r.loadDocuments(ctx, employeeID, &aggregate); err != nil {
		return nil, err
	}
	if err := r.loadAccountLink(ctx, employeeID, &aggregate); err != nil {
		return nil, err
	}
	return &aggregate, nil
}

func (r *EmployeeRepository) loadEmergencyContacts(ctx context.Context, employeeID string, aggregate *application.EmployeeAggregate) error {
	rows, err := r.pool.Query(ctx, `
		select id::text, name, relationship, phone, priority, verified_at::text
		from hr.emergency_contact where employee_id = $1 order by priority`, employeeID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var contact application.EmergencyContactRecord
		if err := rows.Scan(&contact.ID, &contact.Name, &contact.Relationship, &contact.Phone, &contact.Priority, &contact.VerifiedAt); err != nil {
			return err
		}
		aggregate.EmergencyContacts = append(aggregate.EmergencyContacts, contact)
	}
	return rows.Err()
}

func (r *EmployeeRepository) loadEmployment(ctx context.Context, employeeID string, aggregate *application.EmployeeAggregate) error {
	episodeRows, err := r.pool.Query(ctx, `
		select id::text, episode_no, employment_type, start_date::text, end_date::text,
		       probation_end_date::text, end_reason
		from hr.employment_episode where employee_id = $1 order by episode_no`, employeeID)
	if err != nil {
		return err
	}
	for episodeRows.Next() {
		var episode application.EpisodeRecord
		if err := episodeRows.Scan(&episode.ID, &episode.EpisodeNo, &episode.EmploymentType,
			&episode.StartDate, &episode.EndDate, &episode.ProbationEndDate, &episode.EndReason); err != nil {
			episodeRows.Close()
			return err
		}
		aggregate.Episodes = append(aggregate.Episodes, episode)
	}
	episodeRows.Close()
	if err := episodeRows.Err(); err != nil {
		return err
	}

	contractRows, err := r.pool.Query(ctx, `
		select c.id::text, c.episode_id::text, c.contract_type, c.start_date::text, c.end_date::text,
		       c.signed_on::text, c.archive_document_id
		from hr.employment_contract c
		join hr.employment_episode e on e.id = c.episode_id
		where e.employee_id = $1
		order by c.start_date`, employeeID)
	if err != nil {
		return err
	}
	defer contractRows.Close()
	for contractRows.Next() {
		var contract application.ContractRecord
		if err := contractRows.Scan(&contract.ID, &contract.EpisodeID, &contract.ContractType,
			&contract.StartDate, &contract.EndDate, &contract.SignedOn, &contract.ArchiveDocumentID); err != nil {
			return err
		}
		aggregate.Contracts = append(aggregate.Contracts, contract)
	}
	return contractRows.Err()
}

func (r *EmployeeRepository) loadAssignments(ctx context.Context, employeeID string, aggregate *application.EmployeeAggregate) error {
	assignmentRows, err := r.pool.Query(ctx, `
		select id::text, branch_id::text, work_location_id::text, org_unit_id::text,
		       job_title_id::text, job_grade_id::text, work_arrangement, work_schedule_id::text,
		       cost_center_ref, valid_from::text, valid_to::text, reason
		from hr.employee_org_assignment where employee_id = $1 order by valid_from`, employeeID)
	if err != nil {
		return err
	}
	for assignmentRows.Next() {
		var row application.AssignmentRecord
		if err := assignmentRows.Scan(&row.ID, &row.BranchID, &row.WorkLocationID, &row.OrgUnitID,
			&row.JobTitleID, &row.JobGradeID, &row.WorkArrangement, &row.WorkScheduleID,
			&row.CostCenterRef, &row.ValidFrom, &row.ValidTo, &row.Reason); err != nil {
			assignmentRows.Close()
			return err
		}
		aggregate.Assignments = append(aggregate.Assignments, row)
	}
	assignmentRows.Close()
	if err := assignmentRows.Err(); err != nil {
		return err
	}

	managerRows, err := r.pool.Query(ctx, `
		select id::text, manager_employee_id::text, valid_from::text, valid_to::text, reason
		from hr.employee_manager_assignment where employee_id = $1 order by valid_from`, employeeID)
	if err != nil {
		return err
	}
	defer managerRows.Close()
	for managerRows.Next() {
		var row application.ManagerRecord
		if err := managerRows.Scan(&row.ID, &row.ManagerEmployeeID, &row.ValidFrom, &row.ValidTo, &row.Reason); err != nil {
			return err
		}
		aggregate.Managers = append(aggregate.Managers, row)
	}
	return managerRows.Err()
}

func (r *EmployeeRepository) loadDocuments(ctx context.Context, employeeID string, aggregate *application.EmployeeAggregate) error {
	rows, err := r.pool.Query(ctx, `
		select id::text, archive_document_id, document_type, classification, issued_on::text, expires_on::text
		from hr.employee_document_ref where employee_id = $1 order by document_type`, employeeID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var document application.DocumentRecord
		if err := rows.Scan(&document.ID, &document.ArchiveDocumentID, &document.DocumentType,
			&document.Classification, &document.IssuedOn, &document.ExpiresOn); err != nil {
			return err
		}
		aggregate.Documents = append(aggregate.Documents, document)
	}
	return rows.Err()
}

func (r *EmployeeRepository) loadAccountLink(ctx context.Context, employeeID string, aggregate *application.EmployeeAggregate) error {
	var link application.AccountLinkRecord
	err := r.pool.QueryRow(ctx, `
		select account_id::text, linked_at from hr.employee_account_link
		where employee_id = $1 and unlinked_at is null`, employeeID).
		Scan(&link.AccountID, &link.LinkedAt)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil
		}
		return err
	}
	aggregate.AccountLink = &link
	return nil
}

// FindIDByAccount resolves the employee of a login account. A nil result means "not linked".
func (r *EmployeeRepository) FindIDByAccount(ctx context.Context, organizationID, accountID string) (*string, error) {
	var employeeID string
	err := r.pool.QueryRow(ctx, `
		select employee_id::text from hr.employee_account_link
		where organization_id = $1 and account_id = $2 and unlinked_at is null`,
		organizationID, accountID).Scan(&employeeID)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &employeeID, nil
}

// NationalIDHashExists reports whether the national identifier is already recorded.
func (r *EmployeeRepository) NationalIDHashExists(ctx context.Context, organizationID, hash string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.employee_person p
		join hr.employee e on e.id = p.employee_id
		where e.organization_id = $1 and p.national_id_hash = $2`, organizationID, hash)
}

// WorkEmailExists reports whether the work email is already used.
func (r *EmployeeRepository) WorkEmailExists(ctx context.Context, organizationID, email string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.employee where organization_id = $1 and work_email = $2`, organizationID, email)
}

// EmployeeNumberExists reports whether the number is already used.
func (r *EmployeeRepository) EmployeeNumberExists(ctx context.Context, organizationID, employeeNumber string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.employee where organization_id = $1 and employee_number = $2`, organizationID, employeeNumber)
}

func (r *EmployeeRepository) exists(ctx context.Context, sql string, args ...any) (bool, error) {
	var one int
	err := r.pool.QueryRow(ctx, sql, args...).Scan(&one)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// Search runs the permission-aware employee list.
//
// The data scope is translated into a SQL predicate, never applied by filtering a full result set
// in memory (SEC-003). Pagination is keyset-based and bounded, so a large organization costs the
// same per page (PERF-003).
func (r *EmployeeRepository) Search(ctx context.Context, organizationID string, filter application.SearchFilter, scope application.DataScope, limit int, cursor *application.Cursor) (application.SearchPage, error) {
	args := []any{organizationID}
	where := []string{"e.organization_id = $1", "e.archived_at is null"}

	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, strings.ReplaceAll(clause, "?", "$"+strconv.Itoa(len(args))))
	}

	switch scope.Level {
	case "all":
	case "own":
		if scope.ActorEmployeeID == nil {
			where = append(where, "false")
		} else {
			add("e.id = ?::uuid", *scope.ActorEmployeeID)
		}
	case "unit", "subtree":
		if scope.ActorOrgUnitPath == nil {
			where = append(where, "false")
		} else if scope.Level == "unit" {
			add("ou.path = ?::ltree", *scope.ActorOrgUnitPath)
		} else {
			add("ou.path <@ ?::ltree", *scope.ActorOrgUnitPath)
		}
	default:
		// An unknown scope level must fail closed, never widen access.
		where = append(where, "false")
	}

	if len(filter.Statuses) > 0 {
		placeholders := make([]string, 0, len(filter.Statuses))
		for _, status := range filter.Statuses {
			args = append(args, string(status))
			placeholders = append(placeholders, "$"+strconv.Itoa(len(args)))
		}
		where = append(where, "e.status in ("+strings.Join(placeholders, ", ")+")")
	}
	if filter.BranchID != "" {
		add("a.branch_id = ?::uuid", filter.BranchID)
	}
	if filter.OrgUnitID != "" {
		add("a.org_unit_id = ?::uuid", filter.OrgUnitID)
	}
	if filter.JobTitleID != "" {
		add("a.job_title_id = ?::uuid", filter.JobTitleID)
	}
	if filter.WorkLocationID != "" {
		add("a.work_location_id = ?::uuid", filter.WorkLocationID)
	}
	if filter.ManagerEmployeeID != "" {
		add("m.manager_employee_id = ?::uuid", filter.ManagerEmployeeID)
	}
	if trimmed := strings.TrimSpace(filter.Query); trimmed != "" {
		pattern := "%" + escapeLike(trimmed) + "%"
		args = append(args, pattern)
		position := "$" + strconv.Itoa(len(args))
		where = append(where, fmt.Sprintf(
			`(e.employee_number ilike %s or e.work_email ilike %s
			  or p.given_name_en ilike %s or p.family_name_en ilike %s
			  or p.given_name_ar ilike %s or p.family_name_ar ilike %s)`,
			position, position, position, position, position, position))
	}
	if cursor != nil {
		args = append(args, cursor.Key, cursor.ID)
		where = append(where, fmt.Sprintf(
			"(e.employee_number > $%d or (e.employee_number = $%d and e.id > $%d::uuid))",
			len(args)-1, len(args)-1, len(args)))
	}

	args = append(args, limit+1)
	query := fmt.Sprintf(`
		select e.id::text, e.employee_number,
		       p.given_name_en, p.family_name_en, p.given_name_ar, p.family_name_ar,
		       e.status, e.work_email,
		       b.name_en, b.name_ar, ou.name_en, ou.name_ar, jt.name_en, jt.name_ar,
		       wl.name_en, wl.name_ar,
		       mp.given_name_en, mp.family_name_en, mp.given_name_ar, mp.family_name_ar
		from hr.employee e
		join hr.employee_person p on p.employee_id = e.id
		left join hr.employee_org_assignment a on a.employee_id = e.id and a.valid_to is null
		left join hr.org_unit ou on ou.id = a.org_unit_id
		left join hr.branch b on b.id = a.branch_id
		left join hr.work_location wl on wl.id = a.work_location_id
		left join hr.job_title jt on jt.id = a.job_title_id
		left join hr.employee_manager_assignment m on m.employee_id = e.id and m.valid_to is null
		left join hr.employee me on me.id = m.manager_employee_id
		left join hr.employee_person mp on mp.employee_id = me.id
		where %s
		order by e.employee_number, e.id
		limit $%d`, strings.Join(where, " and "), len(args))

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return application.SearchPage{}, err
	}
	defer rows.Close()

	page := application.SearchPage{Rows: make([]application.EmployeeSearchRow, 0, limit)}
	var (
		status                               string
		givenEn, familyEn, givenAr, familyAr string
		managerGivenEn, managerFamilyEn      *string
		managerGivenAr, managerFamilyAr      *string
	)
	for rows.Next() {
		var row application.EmployeeSearchRow
		if err := rows.Scan(&row.ID, &row.EmployeeNumber,
			&givenEn, &familyEn, &givenAr, &familyAr,
			&status, &row.WorkEmail,
			&row.BranchNameEn, &row.BranchNameAr, &row.UnitNameEn, &row.UnitNameAr,
			&row.JobTitleNameEn, &row.JobTitleNameAr, &row.LocationNameEn, &row.LocationNameAr,
			&managerGivenEn, &managerFamilyEn, &managerGivenAr, &managerFamilyAr); err != nil {
			return application.SearchPage{}, err
		}
		row.Status = domain.EmploymentStatus(status)
		row.DisplayNameEn = strings.TrimSpace(givenEn + " " + familyEn)
		row.DisplayNameAr = strings.TrimSpace(givenAr + " " + familyAr)
		if managerGivenEn != nil && managerFamilyEn != nil {
			name := strings.TrimSpace(*managerGivenEn + " " + *managerFamilyEn)
			row.ManagerNameEn = &name
		}
		if managerGivenAr != nil && managerFamilyAr != nil {
			name := strings.TrimSpace(*managerGivenAr + " " + *managerFamilyAr)
			row.ManagerNameAr = &name
		}
		page.Rows = append(page.Rows, row)
	}
	if err := rows.Err(); err != nil {
		return application.SearchPage{}, err
	}

	if len(page.Rows) > limit {
		page.Rows = page.Rows[:limit]
		last := page.Rows[len(page.Rows)-1]
		page.NextCursor = &application.Cursor{Key: last.EmployeeNumber, ID: last.ID}
	}
	return page, nil
}

// escapeLike neutralises LIKE wildcards so a search term is matched literally.
func escapeLike(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return replacer.Replace(value)
}

// UpdateCore writes the mutable columns of the employee row.
func (r *EmployeeRepository) UpdateCore(ctx context.Context, q db.Querier, employeeID, workEmail string, status domain.EmploymentStatus, now time.Time) error {
	_, err := q.Exec(ctx, `
		update hr.employee set work_email = $2, status = $3, updated_at = $4 where id = $1`,
		employeeID, workEmail, string(status), now)
	return err
}

// UpdatePerson writes the personal section.
func (r *EmployeeRepository) UpdatePerson(ctx context.Context, q db.Querier, employeeID string, person application.PersonRecord, now time.Time) error {
	_, err := q.Exec(ctx, `
		update hr.employee_person set
			given_name_en = $2, family_name_en = $3, given_name_ar = $4, family_name_ar = $5,
			date_of_birth = $6::date, gender = $7, nationality = $8,
			national_id_ciphertext = $9, national_id_last4 = $10, national_id_hash = $11,
			passport_ciphertext = $12, passport_last4 = $13, updated_at = $14
		where employee_id = $1`,
		employeeID, person.GivenNameEn, person.FamilyNameEn, person.GivenNameAr, person.FamilyNameAr,
		person.DateOfBirth, person.Gender, person.Nationality,
		person.NationalIDCiphertext, person.NationalIDLast4, person.NationalIDHash,
		person.PassportCiphertext, person.PassportLast4, now)
	return err
}

// UpdateContact writes the contact section.
func (r *EmployeeRepository) UpdateContact(ctx context.Context, q db.Querier, employeeID string, contact application.ContactRecord, now time.Time) error {
	_, err := q.Exec(ctx, `
		update hr.employee_contact set personal_email = $2, phone = $3, city = $4, updated_at = $5
		where employee_id = $1`, employeeID, contact.PersonalEmail, contact.Phone, contact.City, now)
	return err
}

// AddEmergencyContact appends one emergency contact.
func (r *EmployeeRepository) AddEmergencyContact(ctx context.Context, q db.Querier, employeeID, organizationID string, input application.EmergencyContactInput) error {
	_, err := q.Exec(ctx, `
		insert into hr.emergency_contact (id, organization_id, employee_id, name, relationship, phone, priority)
		values ($1, $2, $3, $4, $5, $6, $7)`,
		input.ID, organizationID, employeeID, input.Name, input.Relationship, input.Phone, input.Priority)
	return err
}

// LinkAccount records the active link between an employee and a login account.
func (r *EmployeeRepository) LinkAccount(ctx context.Context, q db.Querier, employeeID, organizationID, accountID, actorAccountID string, at time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.employee_account_link (employee_id, organization_id, account_id, linked_at, linked_by)
		values ($1, $2, $3, $4, $5)`, employeeID, organizationID, accountID, at, actorAccountID)
	return err
}

// UnlinkAccount closes the active link instead of deleting it.
func (r *EmployeeRepository) UnlinkAccount(ctx context.Context, q db.Querier, employeeID string, at time.Time) error {
	_, err := q.Exec(ctx, `
		update hr.employee_account_link set unlinked_at = $2
		where employee_id = $1 and unlinked_at is null`, employeeID, at)
	return err
}

// AddDocument appends one document reference.
func (r *EmployeeRepository) AddDocument(ctx context.Context, q db.Querier, employeeID, organizationID string, input application.DocumentInput) error {
	_, err := q.Exec(ctx, `
		insert into hr.employee_document_ref
			(id, organization_id, employee_id, archive_document_id, document_type, classification, issued_on, expires_on)
		values ($1, $2, $3, $4, $5, $6, $7::date, $8::date)`,
		input.ID, organizationID, employeeID, input.ArchiveDocumentID, input.DocumentType,
		input.Classification, input.IssuedOn, input.ExpiresOn)
	return err
}
