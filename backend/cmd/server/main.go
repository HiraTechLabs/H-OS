package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	hrapp "github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	hrinfra "github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/infrastructure"
	hrtransport "github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/transport"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/accounts"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/audit"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/bootstrap"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/config"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/links"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/outbox"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/registry"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/transport"
)

func main() {
	migrateFlag := flag.Bool("migrate", false, "Run database migrations and exit")
	seedFlag := flag.Bool("seed", false, "Run database seed/bootstrap and exit")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// 1. Validate application registry
	if err := registry.Validate(); err != nil {
		logger.Error("registry.invalid", "error", err)
		os.Exit(1)
	}

	// 2. Load runtime configuration
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		logger.Error("config.invalid", "error", err)
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 3. Connect to PostgreSQL
	pool, err := db.Open(ctx, cfg.DatabaseURL, 20)
	if err != nil {
		logger.Error("db.connect_failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	logger.Info("db.connected", "database", "postgres")

	// 4. Initialize Platform Primitives
	hasher := auth.Argon2id{}
	clk := clock.System{}
	cipher, err := hrinfra.NewFieldCipher(cfg.FieldEncryptionKey)
	if err != nil {
		logger.Error("fieldcipher.init_failed", "error", err)
		os.Exit(1)
	}

	// Database migrations if requested or before seed
	if *migrateFlag {
		if err := db.Migrate(ctx, pool); err != nil {
			logger.Error("db.migrate_failed", "error", err)
			os.Exit(1)
		}
		logger.Info("db.migrate_completed")
		return
	}

	// Bootstrap/Seed execution if requested
	if *seedFlag {
		if err := db.Migrate(ctx, pool); err != nil {
			logger.Error("db.migrate_failed", "error", err)
			os.Exit(1)
		}
		res, err := bootstrap.Seed(ctx, pool, &cfg, hasher)
		if err != nil {
			logger.Error("bootstrap.seed_failed", "error", err)
			os.Exit(1)
		}
		logger.Info("bootstrap.seed_completed",
			"organizationId", res.OrganizationID,
			"adminAccountId", res.AdminAccountID,
			"permissions", res.Permissions,
			"roles", res.Roles,
		)
		return
	}

	// Always ensure migrations are applied before serving traffic
	if err := db.Migrate(ctx, pool); err != nil {
		logger.Error("db.auto_migrate_failed", "error", err)
		os.Exit(1)
	}
	logger.Info("db.migrations_applied")

	sessionSettings := auth.SessionSettings{
		TTL:         cfg.SessionTTL,
		IdleTimeout: cfg.SessionIdleTimeout,
		Secure:      cfg.Env == config.Production,
	}
	sessionService := auth.NewSessionService(pool, hasher, clk, sessionSettings, logger)
	rateLimiter := auth.NewRateLimiter(cfg.LoginRateLimit, time.Minute)
	auditRecorder := audit.NewRecorder(clk)
	outboxWriter := outbox.NewWriter(clk)
	linkService := links.NewService(clk)

	accountsDirectory := accounts.NewDirectory(pool)
	accountsManagement := accounts.NewManagement(pool, hasher, sessionService, auditRecorder, clk)

	// 5. Initialize H-HR Repositories and Use Cases
	hrEmployeeRepo := hrinfra.NewEmployeeRepository(pool)
	hrDirectoryRepo := hrinfra.NewDirectoryRepository(pool)
	hrOrganizationRepo := hrinfra.NewOrganizationRepository(pool)
	hrTimelineRepo := hrinfra.NewTimelineRepository(pool)
	hrAssignmentRepo := hrinfra.NewAssignmentRepository(pool)
	hrEmploymentRepo := hrinfra.NewEmploymentRepository(pool)

	hrScope := hrapp.NewActorScope(hrEmployeeRepo, hrDirectoryRepo)
	hrRecorder := hrapp.NewRecorder(auditRecorder, outboxWriter, hrTimelineRepo, clk)

	timeZone := cfg.Organization.TimeZone

	createEmployee := hrapp.NewCreateEmployee(
		pool,
		clk,
		timeZone,
		hrEmployeeRepo,
		hrEmploymentRepo,
		hrAssignmentRepo,
		hrDirectoryRepo,
		cipher,
		accountsDirectory,
		hrRecorder,
		hrScope,
	)
	listEmployees := hrapp.NewListEmployees(hrEmployeeRepo, hrScope)
	getProfile := hrapp.NewGetEmployeeProfile(hrEmployeeRepo, hrOrganizationRepo, hrTimelineRepo, accountsDirectory, hrScope)
	updateEmployee := hrapp.NewUpdateEmployee(pool, clk, timeZone, hrEmployeeRepo, hrRecorder, hrScope)
	changeStatus := hrapp.NewChangeStatus(pool, clk, hrEmployeeRepo, hrEmploymentRepo, hrAssignmentRepo, sessionService, hrRecorder, hrScope)
	changeAssignment := hrapp.NewChangeAssignment(pool, clk, hrEmployeeRepo, hrAssignmentRepo, hrDirectoryRepo, sessionService, hrRecorder, hrScope)
	changeManager := hrapp.NewChangeManager(pool, clk, hrEmployeeRepo, hrAssignmentRepo, hrDirectoryRepo, hrRecorder, hrScope)
	linkAccount := hrapp.NewLinkAccount(pool, clk, hrEmployeeRepo, accountsDirectory, hrRecorder, hrScope)
	addContact := hrapp.NewAddEmergencyContact(pool, clk, timeZone, hrEmployeeRepo, hrRecorder, hrScope)
	addDocument := hrapp.NewAddDocumentReference(pool, clk, timeZone, hrEmployeeRepo, linkService, hrRecorder, hrScope)

	getOrganization := hrapp.NewGetOrganization(hrOrganizationRepo)
	createBranch := hrapp.NewCreateBranch(pool, clk, hrOrganizationRepo, auditRecorder, hrScope)
	createWorkLocation := hrapp.NewCreateWorkLocation(pool, clk, hrOrganizationRepo, hrDirectoryRepo, auditRecorder, hrScope)
	createOrgUnit := hrapp.NewCreateOrgUnit(pool, clk, timeZone, hrOrganizationRepo, hrDirectoryRepo, auditRecorder, hrScope)
	createJobTitle := hrapp.NewCreateJobTitle(pool, clk, hrOrganizationRepo, auditRecorder, hrScope)
	createJobGrade := hrapp.NewCreateJobGrade(pool, clk, hrOrganizationRepo, auditRecorder, hrScope)
	createWorkSchedule := hrapp.NewCreateWorkSchedule(pool, clk, hrOrganizationRepo, auditRecorder, hrScope)

	// 6. Router and Transport Wiring
	r := router.New()

	// Platform Handlers
	authHandler := transport.NewAuthHandler(sessionService, rateLimiter)
	authHandler.Register(r)

	accountsHandler := transport.NewAccountHandler(sessionService, accountsManagement)
	accountsHandler.Register(r)

	registryHandler := transport.NewRegistryHandler(sessionService)
	registryHandler.Register(r)

	healthHandler := transport.NewHealthHandler(pool)
	healthHandler.Register(r)

	// H-HR Application Handler
	hrHandler := hrtransport.NewHandler(
		sessionService,
		createEmployee,
		listEmployees,
		getProfile,
		updateEmployee,
		changeStatus,
		changeAssignment,
		changeManager,
		linkAccount,
		addContact,
		addDocument,
		getOrganization,
		createBranch,
		createWorkLocation,
		createOrgUnit,
		createJobTitle,
		createJobGrade,
		createWorkSchedule,
	)
	hrHandler.Register(r)

	// 7. Middlewares
	var handler http.Handler = r
	handler = httpx.OriginGuard(cfg.CORSOrigins)(handler)
	handler = httpx.CORS(cfg.CORSOrigins)(handler)
	handler = httpx.SecurityHeaders(handler)
	handler = httpx.Logging(logger)(handler)
	handler = httpx.Recovery(logger)(handler)
	handler = httpx.RequestContextMiddleware(handler)

	// 8. HTTP Server Lifecycle
	addr := fmt.Sprintf(":%d", cfg.Port)
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("server.starting", "port", cfg.Port, "env", string(cfg.Env))
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	// 9. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		logger.Error("server.failed", "error", err)
		os.Exit(1)
	case sig := <-quit:
		logger.Info("server.shutdown_started", "signal", sig.String())
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("server.shutdown_failed", "error", err)
			_ = server.Close()
		}
		logger.Info("server.shutdown_complete")
	}
}
