## C# Development Standards and Patterns

### Modern Language Features

#### Nullable Reference Types Implementation
```csharp
// Enable nullable reference types for null safety
<PropertyGroup>
    <Nullable>enable</Nullable>
</PropertyGroup>

// Proper usage patterns
public class UserService
{
    public User? FindUser(string email) // May return null
    {
        return _users.FirstOrDefault(u => u.Email == email);
    }

    public string GetUserDisplayName(User user) // Never null
    {
        return user.Name ?? "Unknown User";
    }
}
```

#### Record Types and Pattern Matching
```csharp
// Record types for immutable data transfer
public record CreateUserRequest(string Email, string Name, DateTime DateOfBirth);

// Pattern matching with switch expressions
public string GetUserCategory(User user) => user.Age switch
{
    < 18 => "Minor",
    >= 18 and < 65 => "Adult",
    >= 65 => "Senior",
    _ => "Unknown"
};

// Property patterns for complex logic
public decimal CalculateDiscount(Order order) => order switch
{
    { Items.Count: > 10, TotalAmount: > 1000 } => 0.15m,
    { Items.Count: > 5 } => 0.10m,
    { TotalAmount: > 500 } => 0.05m,
    _ => 0m
};
```

#### Collection Expressions and Modern Syntax
```csharp
// Collection expressions (C# 12+)
List<string> names = ["Alice", "Bob", "Charlie"];
int[] numbers = [1, 2, 3, 4, 5];

// Target-typed new expressions
Dictionary<string, object> settings = new()
{
    ["timeout"] = 30,
    ["retries"] = 3
};

// Raw string literals for complex content
string json = """
    {
        "name": "Product",
        "price": 29.99
    }
    """;
```

### Performance Optimization Patterns

#### Memory Management and Allocation
```csharp
// Use Span<T> for stack-allocated data
public int ProcessData(ReadOnlySpan<byte> data)
{
    var sum = 0;
    foreach (var b in data)
    {
        sum += b;
    }
    return sum;
}

// Object pooling for expensive objects
public class ObjectPoolService
{
    private readonly ObjectPool<StringBuilder> _pool;

    public ObjectPoolService()
    {
        _pool = new DefaultObjectPool<StringBuilder>(new StringBuilderPooledObjectPolicy());
    }

    public string ProcessText(IEnumerable<string> inputs)
    {
        var sb = _pool.Get();
        try
        {
            foreach (var input in inputs)
            {
                sb.AppendLine(input);
            }
            return sb.ToString();
        }
        finally
        {
            _pool.Return(sb);
        }
    }
}

// ArrayPool for temporary arrays
private static readonly ArrayPool<byte> _arrayPool = ArrayPool<byte>.Shared;

public void ProcessLargeData(int size)
{
    var buffer = _arrayPool.Rent(size);
    try
    {
        ProcessBuffer(buffer.AsSpan(0, size));
    }
    finally
    {
        _arrayPool.Return(buffer);
    }
}
```

#### Async/Await Best Practices
```csharp
// Async all the way pattern
public async Task<UserProfile> GetUserProfileAsync(int userId)
{
    var userTask = _userRepository.GetByIdAsync(userId);
    var ordersTask = _orderRepository.GetUserOrdersAsync(userId);
    var preferencesTask = _preferencesRepository.GetUserPreferencesAsync(userId);

    await Task.WhenAll(userTask, ordersTask, preferencesTask);

    return new UserProfile
    {
        User = userTask.Result,
        Orders = ordersTask.Result,
        Preferences = preferencesTask.Result
    };
}

// ConfigureAwait in libraries
public async Task<string> FetchDataAsync(string url)
{
    using var httpClient = new HttpClient();
    var response = await httpClient.GetAsync(url).ConfigureAwait(false);
    return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
}

// Cancellation token support
public async Task<IEnumerable<Order>> ProcessOrdersAsync(
    IEnumerable<int> orderIds,
    CancellationToken cancellationToken = default)
{
    var tasks = orderIds.Select(async id =>
    {
        cancellationToken.ThrowIfCancellationRequested();
        return await _orderService.ProcessOrderAsync(id, cancellationToken);
    });

    return await Task.WhenAll(tasks);
}
```

### Architecture and Design Patterns

#### Clean Architecture Implementation
```csharp
// Domain layer - Core business logic
public class User
{
    public Guid Id { get; private set; }
    public string Email { get; private set; }
    public string Name { get; private set; }

    private User() { } // EF Core constructor

    public static User Create(string email, string name)
    {
        ValidateEmail(email);
        ValidateName(name);

        return new User
        {
            Id = Guid.NewGuid(),
            Email = email.ToLowerInvariant(),
            Name = name.Trim()
        };
    }

    public void UpdateName(string newName)
    {
        ValidateName(newName);
        Name = newName.Trim();
    }

    private static void ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new DomainException("Email is required");

        if (!IsValidEmail(email))
            throw new DomainException("Invalid email format");
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Name is required");

        if (name.Length > 100)
            throw new DomainException("Name cannot exceed 100 characters");
    }

    private static bool IsValidEmail(string email)
    {
        return System.Text.RegularExpressions.Regex.IsMatch(email,
            @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
    }
}

// Application layer - Use cases and business workflows
public class CreateUserCommand
{
    public string Email { get; set; } = default!;
    public string Name { get; set; } = default!;
}

public interface ICreateUserHandler
{
    Task<OperationResult<UserDto>> HandleAsync(CreateUserCommand command, CancellationToken cancellationToken = default);
}

public class CreateUserHandler : ICreateUserHandler
{
    private readonly IUserRepository _userRepository;
    private readonly IEmailService _emailService;
    private readonly ILogger<CreateUserHandler> _logger;

    public CreateUserHandler(
        IUserRepository userRepository,
        IEmailService emailService,
        ILogger<CreateUserHandler> logger)
    {
        _userRepository = userRepository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<OperationResult<UserDto>> HandleAsync(
        CreateUserCommand command,
        CancellationToken cancellationToken = default)
    {
        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["Operation"] = "CreateUser",
            ["UserEmail"] = command.Email
        });

        _logger.LogInformation("Creating user with email {Email}", command.Email);

        try
        {
            // Check if user already exists
            var existingUser = await _userRepository.FindByEmailAsync(command.Email, cancellationToken);
            if (existingUser != null)
            {
                return OperationResult<UserDto>.Failure("User already exists with this email");
            }

            // Create domain entity
            var user = User.Create(command.Email, command.Name);

            // Save to repository
            var savedUser = await _userRepository.SaveAsync(user, cancellationToken);

            // Send welcome email
            await _emailService.SendWelcomeEmailAsync(savedUser.Email, savedUser.Name, cancellationToken);

            _logger.LogInformation("User created successfully with ID {UserId}", savedUser.Id);

            return OperationResult<UserDto>.Success(new UserDto
            {
                Id = savedUser.Id,
                Email = savedUser.Email,
                Name = savedUser.Name
            });
        }
        catch (DomainException ex)
        {
            _logger.LogWarning("Domain validation failed: {Message}", ex.Message);
            return OperationResult<UserDto>.Failure(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating user");
            return OperationResult<UserDto>.Failure("An unexpected error occurred");
        }
    }
}
```

#### CQRS Implementation
```csharp
// Command side - Write operations
public interface ICommandHandler<TCommand, TResult>
{
    Task<TResult> HandleAsync(TCommand command, CancellationToken cancellationToken = default);
}

// Query side - Read operations
public interface IQueryHandler<TQuery, TResult>
{
    Task<TResult> HandleAsync(TQuery query, CancellationToken cancellationToken = default);
}

public class GetUserByIdQuery
{
    public Guid UserId { get; set; }
}

public class GetUserByIdHandler : IQueryHandler<GetUserByIdQuery, UserDto?>
{
    private readonly IUserReadRepository _readRepository;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetUserByIdHandler> _logger;

    public GetUserByIdHandler(
        IUserReadRepository readRepository,
        IMemoryCache cache,
        ILogger<GetUserByIdHandler> logger)
    {
        _readRepository = readRepository;
        _cache = cache;
        _logger = logger;
    }

    public async Task<UserDto?> HandleAsync(GetUserByIdQuery query, CancellationToken cancellationToken = default)
    {
        var cacheKey = $"user:{query.UserId}";

        if (_cache.TryGetValue(cacheKey, out UserDto? cachedUser))
        {
            _logger.LogDebug("User {UserId} found in cache", query.UserId);
            return cachedUser;
        }

        var user = await _readRepository.GetByIdAsync(query.UserId, cancellationToken);

        if (user != null)
        {
            _cache.Set(cacheKey, user, TimeSpan.FromMinutes(15));
            _logger.LogDebug("User {UserId} cached for 15 minutes", query.UserId);
        }

        return user;
    }
}
```

### Entity Framework Core Patterns

#### Entity Configuration with Fluent API
```csharp
public class ServiceContext : DbContext, IServiceContext
{
    public DbSet<User> Users { get; set; }
    public DbSet<Order> Orders { get; set; }
    public DbSet<OrderDetails> OrderDetails { get; set; }

    public ServiceContext(DbContextOptions<ServiceContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User entity configuration
        _ = modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.Email)
                .IsRequired()
                .HasMaxLength(255)
                .HasConversion(
                    v => v.ToLowerInvariant(),
                    v => v);

            entity.HasIndex(e => e.Email).IsUnique();

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);
        });

        // Order entity configuration with relationships
        _ = modelBuilder.Entity<Order>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();

            entity.Property(e => e.TotalAmount)
                .HasColumnType("decimal(18,2)")
                .IsRequired();

            entity.Property(e => e.Status)
                .HasConversion<string>()
                .HasMaxLength(50);

            // One-to-many relationship
            entity.HasMany(e => e.OrderItems)
                .WithOne(e => e.Order)
                .HasForeignKey(e => e.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Many-to-one relationship
            entity.HasOne(e => e.User)
                .WithMany(e => e.Orders)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // One-to-one relationship configuration
        _ = modelBuilder.Entity<Order>()
            .HasOne<OrderDetails>(e => e.Details)
            .WithOne(e => e.Order)
            .HasForeignKey<OrderDetails>(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);
    }
}

// Repository implementation with proper async patterns
public class EfUserRepository : IUserRepository
{
    private readonly IServiceContext _context;
    private readonly ILogger<EfUserRepository> _logger;

    public EfUserRepository(IServiceContext context, ILogger<EfUserRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<User?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
    }

    public async Task<User?> FindByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant(), cancellationToken);
    }

    public async Task<User> SaveAsync(User user, CancellationToken cancellationToken = default)
    {
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == user.Id, cancellationToken);

        if (existingUser == null)
        {
            _context.Users.Add(user);
        }
        else
        {
            _context.Entry(existingUser).CurrentValues.SetValues(user);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<IEnumerable<User>> FindBySpecificationAsync(
        ISpecification<User> specification,
        CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .Where(specification.ToExpression())
            .ToListAsync(cancellationToken);
    }
}
```

### Testing Infrastructure Patterns

#### Comprehensive Unit Testing with xUnit and Moq
```csharp
public class CreateUserHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IEmailService> _emailServiceMock;
    private readonly Mock<ILogger<CreateUserHandler>> _loggerMock;
    private readonly Fixture _fixture;

    public CreateUserHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _emailServiceMock = new Mock<IEmailService>();
        _loggerMock = new Mock<ILogger<CreateUserHandler>>();

        _fixture = new Fixture();
        _fixture.Behaviors.OfType<ThrowingRecursionBehavior>().ToList().ForEach(b => _fixture.Behaviors.Remove(b));
        _fixture.Behaviors.Add(new OmitOnRecursionBehavior());
    }

    private CreateUserHandler BuildHandler(
        IUserRepository? userRepository = null,
        IEmailService? emailService = null,
        ILogger<CreateUserHandler>? logger = null)
        => new(
            userRepository ?? _userRepositoryMock.Object,
            emailService ?? _emailServiceMock.Object,
            logger ?? _loggerMock.Object);

    [Fact]
    public async Task HandleAsync_Should_CreateUser_When_ValidCommandProvided()
    {
        // Arrange
        var command = _fixture.Build<CreateUserCommand>()
            .With(x => x.Email, "test@example.com")
            .With(x => x.Name, "Test User")
            .Create();

        var expectedUser = User.Create(command.Email, command.Name);

        _ = _userRepositoryMock
            .Setup(x => x.FindByEmailAsync(command.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        _ = _userRepositoryMock
            .Setup(x => x.SaveAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedUser);

        var handler = BuildHandler();

        // Act
        var result = await handler.HandleAsync(command);

        // Assert
        result.Should().NotBeNull();
        result.IsSuccess.Should().BeTrue();
        result.Value.Email.Should().Be(command.Email);
        result.Value.Name.Should().Be(command.Name);

        _userRepositoryMock.Verify(x => x.FindByEmailAsync(command.Email, It.IsAny<CancellationToken>()), Times.Once);
        _userRepositoryMock.Verify(x => x.SaveAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Once);
        _emailServiceMock.Verify(x => x.SendWelcomeEmailAsync(command.Email, command.Name, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task HandleAsync_Should_ReturnFailure_When_UserAlreadyExists()
    {
        // Arrange
        var command = _fixture.Create<CreateUserCommand>();
        var existingUser = _fixture.Create<User>();

        _ = _userRepositoryMock
            .Setup(x => x.FindByEmailAsync(command.Email, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        var handler = BuildHandler();

        // Act
        var result = await handler.HandleAsync(command);

        // Assert
        result.Should().NotBeNull();
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be("User already exists with this email");

        _userRepositoryMock.Verify(x => x.SaveAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Never);
        _emailServiceMock.Verify(x => x.SendWelcomeEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [InlineData("", "Valid Name")]
    [InlineData("invalid-email", "Valid Name")]
    [InlineData("valid@email.com", "")]
    public async Task HandleAsync_Should_ReturnFailure_When_ValidationFails(string email, string name)
    {
        // Arrange
        var command = new CreateUserCommand { Email = email, Name = name };
        var handler = BuildHandler();

        // Act
        var result = await handler.HandleAsync(command);

        // Assert
        result.Should().NotBeNull();
        result.IsFailure.Should().BeTrue();
        result.Error.Should().NotBeNullOrEmpty();

        _userRepositoryMock.Verify(x => x.SaveAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
```

#### Integration Testing with Test Containers
```csharp
public class UserIntegrationTests : IClassFixture<WebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private PostgreSqlContainer _dbContainer = null!;
    private RedisContainer _redisContainer = null!;

    public UserIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = _factory.CreateClient();
    }

    public async Task InitializeAsync()
    {
        // Start test containers
        _dbContainer = new PostgreSqlContainer()
            .WithDatabase("testdb")
            .WithUsername("testuser")
            .WithPassword("testpass");

        _redisContainer = new RedisContainer();

        await _dbContainer.StartAsync();
        await _redisContainer.StartAsync();

        // Configure test services
        Environment.SetEnvironmentVariable("DATABASE_URL", _dbContainer.GetConnectionString());
        Environment.SetEnvironmentVariable("REDIS_URL", _redisContainer.GetConnectionString());
    }

    public async Task DisposeAsync()
    {
        await _dbContainer.DisposeAsync();
        await _redisContainer.DisposeAsync();
    }

    [Fact]
    public async Task CreateUser_Should_Return201_When_ValidDataProvided()
    {
        // Arrange
        var createRequest = new CreateUserRequest
        {
            Email = "integration-test@example.com",
            Name = "Integration Test User"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/users", createRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var userResponse = await response.Content.ReadFromJsonAsync<UserResponse>();
        userResponse.Should().NotBeNull();
        userResponse!.Email.Should().Be(createRequest.Email);
        userResponse.Name.Should().Be(createRequest.Name);
        userResponse.Id.Should().NotBeEmpty();

        // Verify persistence
        var getResponse = await _client.GetAsync($"/api/users/{userResponse.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var persistedUser = await getResponse.Content.ReadFromJsonAsync<UserResponse>();
        persistedUser.Should().BeEquivalentTo(userResponse);
    }

    [Fact]
    public async Task CreateUser_Should_Return400_When_DuplicateEmail()
    {
        // Arrange
        var createRequest = new CreateUserRequest
        {
            Email = "duplicate@example.com",
            Name = "First User"
        };

        // Create first user
        var firstResponse = await _client.PostAsJsonAsync("/api/users", createRequest);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        // Try to create duplicate
        var duplicateRequest = new CreateUserRequest
        {
            Email = "duplicate@example.com",
            Name = "Second User"
        };

        // Act
        var response = await _client.PostAsJsonAsync("/api/users", duplicateRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var errorResponse = await response.Content.ReadAsStringAsync();
        errorResponse.Should().Contain("already exists");
    }
}
```

### Logging and Observability Patterns

#### Logger Delegate Pattern Implementation
```csharp
public static partial class UserServiceLogger
{
    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "Creating user with email {UserEmail}")]
    public static partial void LogUserCreationStarted(this ILogger logger, string userEmail);

    [LoggerMessage(
        Level = LogLevel.Information,
        Message = "User created successfully with ID {UserId} and email {UserEmail}")]
    public static partial void LogUserCreatedSuccessfully(this ILogger logger, Guid userId, string userEmail);

    [LoggerMessage(
        Level = LogLevel.Warning,
        Message = "User creation failed for email {UserEmail} - {Reason}")]
    public static partial void LogUserCreationFailed(this ILogger logger, string userEmail, string reason);

    [LoggerMessage(
        Level = LogLevel.Error,
        Message = "Unexpected error creating user with email {UserEmail}")]
    public static partial void LogUserCreationError(this ILogger logger, Exception exception, string userEmail);

    [LoggerMessage(
        Level = LogLevel.Debug,
        Message = "User {UserId} found in cache")]
    public static partial void LogUserFoundInCache(this ILogger logger, Guid userId);

    [LoggerMessage(
        Level = LogLevel.Debug,
        Message = "User {UserId} cached for {CacheDuration} minutes")]
    public static partial void LogUserCached(this ILogger logger, Guid userId, int cacheDuration);
}

// Usage in service
public class CreateUserHandler : ICreateUserHandler
{
    private readonly ILogger<CreateUserHandler> _logger;
    // ... other dependencies

    public async Task<OperationResult<UserDto>> HandleAsync(
        CreateUserCommand command,
        CancellationToken cancellationToken = default)
    {
        _logger.LogUserCreationStarted(command.Email);

        try
        {
            // ... business logic

            var savedUser = await _userRepository.SaveAsync(user, cancellationToken);

            _logger.LogUserCreatedSuccessfully(savedUser.Id, savedUser.Email);

            return OperationResult<UserDto>.Success(userDto);
        }
        catch (DomainException ex)
        {
            _logger.LogUserCreationFailed(command.Email, ex.Message);
            return OperationResult<UserDto>.Failure(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogUserCreationError(ex, command.Email);
            return OperationResult<UserDto>.Failure("An unexpected error occurred");
        }
    }
}
```

### Security and Configuration Patterns

#### Secure Configuration Management
```csharp
// Configuration classes with IOptions pattern
public class DatabaseConfigOptions : BaseConfigOptions
{
    public static new readonly string SectionName = "Database";
    public string ConnectionString { get; set; } = default!;
    public int PoolSize { get; set; } = 10;
    public int CommandTimeout { get; set; } = 30;
    public bool EnableSensitiveDataLogging { get; set; } = false;
}

public class ExternalApiConfigOptions : BaseConfigOptions
{
    public static new readonly string SectionName = "ExternalApis";
    public string OpenAiApiKey { get; set; } = default!;
    public string StripeApiKey { get; set; } = default!;
    public string BaseUrl { get; set; } = default!;
    public int TimeoutSeconds { get; set; } = 30;
}

// Configuration registration in extensions
public static class ConfigurationRegistrationExtensions
{
    public static IServiceCollection RegisterConfigurations(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<DatabaseConfigOptions>(
            configuration.GetSection(DatabaseConfigOptions.SectionName));

        services.Configure<ExternalApiConfigOptions>(
            configuration.GetSection(ExternalApiConfigOptions.SectionName));

        return services;
    }
}

// Secure service registration with configuration
public static class ServiceRegistrationExtensions
{
    public static IServiceCollection RegisterApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Register services with configuration
        services.AddScoped<IDatabaseService>((provider) =>
        {
            var config = provider.GetRequiredService<IOptions<DatabaseConfigOptions>>();
            return new DatabaseService(config.Value.ConnectionString);
        });

        services.AddHttpClient<IExternalApiClient, ExternalApiClient>((serviceProvider, httpClient) =>
        {
            var config = serviceProvider.GetRequiredService<IOptions<ExternalApiConfigOptions>>();
            httpClient.BaseAddress = new Uri(config.Value.BaseUrl);
            httpClient.Timeout = TimeSpan.FromSeconds(config.Value.TimeoutSeconds);
            httpClient.DefaultRequestHeaders.Add("User-Agent", "MyApp/1.0");
        });

        return services;
    }
}

// Program.cs configuration with Azure Key Vault
public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // Configuration from multiple sources
        builder.Configuration
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
            .AddEnvironmentVariables(prefix: "APP_");

        // Add Azure Key Vault in production
        if (builder.Environment.IsProduction())
        {
            var keyVaultEndpoint = builder.Configuration["KeyVaultEndpoint"];
            if (!string.IsNullOrEmpty(keyVaultEndpoint))
            {
                builder.Configuration.AddAzureKeyVault(
                    new Uri(keyVaultEndpoint),
                    new DefaultAzureCredential());
            }
        }

        // Add User Secrets in development
        if (builder.Environment.IsDevelopment())
        {
            builder.Configuration.AddUserSecrets<Program>();
        }

        // Register services
        builder.Services.RegisterConfigurations(builder.Configuration);
        builder.Services.RegisterApplicationServices(builder.Configuration);

        var app = builder.Build();

        // Configure pipeline
        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }
        else
        {
            app.UseExceptionHandler("/Error");
            app.UseHsts();
        }

        app.UseHttpsRedirection();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();
        app.Run();
    }
}
```

#### Input Validation and Security
```csharp
// Comprehensive input validation with Data Annotations
public class CreateUserRequest
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    [MaxLength(255, ErrorMessage = "Email cannot exceed 255 characters")]
    public string Email { get; set; } = default!;

    [Required(ErrorMessage = "Name is required")]
    [MinLength(1, ErrorMessage = "Name cannot be empty")]
    [MaxLength(100, ErrorMessage = "Name cannot exceed 100 characters")]
    [RegularExpression(@"^[a-zA-Z\s'-]+$", ErrorMessage = "Name contains invalid characters")]
    public string Name { get; set; } = default!;

    [Range(18, 120, ErrorMessage = "Age must be between 18 and 120")]
    public int Age { get; set; }

    [Url(ErrorMessage = "Profile URL must be a valid URL")]
    public string? ProfileUrl { get; set; }
}

// Custom validation attribute
public class NoScriptInjectionAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is string stringValue && !string.IsNullOrEmpty(stringValue))
        {
            var dangerousPatterns = new[]
            {
                "<script", "</script>", "javascript:", "vbscript:", "onload=", "onerror="
            };

            if (dangerousPatterns.Any(pattern =>
                stringValue.Contains(pattern, StringComparison.OrdinalIgnoreCase)))
            {
                return new ValidationResult("Input contains potentially dangerous content");
            }
        }

        return ValidationResult.Success;
    }
}

// Secure controller with comprehensive validation
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : BaseController
{
    private readonly ICreateUserHandler _createUserHandler;
    private readonly IGetUserHandler _getUserHandler;
    private readonly ILogger<UsersController> _logger;

    public UsersController(
        ICreateUserHandler createUserHandler,
        IGetUserHandler getUserHandler,
        ILogger<UsersController> logger,
        IAuthorizationHelper authorizationHelper) : base(authorizationHelper)
    {
        _createUserHandler = createUserHandler;
        _getUserHandler = getUserHandler;
        _logger = logger;
    }

    [HttpPost]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> CreateUser(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!IsAuthorized())
        {
            return Unauthorized();
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var command = new CreateUserCommand
            {
                Email = request.Email.Trim().ToLowerInvariant(),
                Name = request.Name.Trim()
            };

            var result = await _createUserHandler.HandleAsync(command, cancellationToken);

            if (result.IsFailure)
            {
                _logger.LogWarning("User creation failed: {Error}", result.Error);
                return BadRequest(new { error = result.Error });
            }

            var response = new UserResponse
            {
                Id = result.Value.Id,
                Email = result.Value.Email,
                Name = result.Value.Name,
                CreatedAt = DateTime.UtcNow
            };

            return CreatedAtAction(nameof(GetUser), new { id = response.Id }, response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error creating user");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = "An unexpected error occurred" });
        }
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(UserResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetUser(
        [FromRoute] Guid id,
        CancellationToken cancellationToken = default)
    {
        if (!IsAuthorized())
        {
            return Unauthorized();
        }

        var query = new GetUserByIdQuery { UserId = id };
        var user = await _getUserHandler.HandleAsync(query, cancellationToken);

        if (user == null)
        {
            return NotFound();
        }

        var response = new UserResponse
        {
            Id = user.Id,
            Email = user.Email,
            Name = user.Name
        };

        return Ok(response);
    }
}
```

## Workspace Tool Integration

### MCP Service Utilization

#### Context7 Integration for Documentation
When Context7 MCP is available, use for project documentation lookup:

```csharp
// Use c7_query for specific technology information
// Use c7_search to find relevant project documentation
// Use c7_info for detailed project context
```

Query Context7 for .NET, ASP.NET Core, Entity Framework, and other technology-specific guidance.

#### GitHub Integration
When GitHub MCP is available, integrate with repository operations:

```csharp
// Use GitHub tools for branch management, PR creation, issue tracking
// Integrate with CI/CD pipeline status and deployment workflows
```

## Quality Standards and Success Criteria

### Code Quality Checklist
Before completing any C# development task:

- [ ] **Modern C# Features**: Utilize appropriate C# language features (nullable reference types, pattern matching, records)
- [ ] **Async/Await Patterns**: Implement proper async patterns with cancellation token support
- [ ] **Dependency Injection**: Use proper DI patterns with appropriate service lifetimes
- [ ] **Error Handling**: Implement comprehensive error handling with custom exceptions
- [ ] **Performance**: Apply memory management and performance optimization techniques
- [ ] **Testing**: Provide comprehensive unit and integration tests
- [ ] **Security**: Implement input validation, authentication, and authorization
- [ ] **Logging**: Use structured logging with Logger Delegate patterns
- [ ] **Configuration**: Use IOptions pattern with secure configuration management
- [ ] **Documentation**: Provide clear code documentation and architectural decisions

### Performance Standards
- **Response Time**: API endpoints respond within 2 seconds under normal load
- **Memory Usage**: Minimize garbage collection pressure through proper memory management
- **Async Operations**: All I/O bound operations use async/await patterns
- **Database Performance**: Optimize EF Core queries and avoid N+1 problems
- **Caching**: Implement appropriate caching strategies for frequently accessed data

### Security Standards
- **Input Validation**: All user input validated and sanitized
- **Authentication**: Proper JWT token validation and user authentication
- **Authorization**: Role-based access control implemented correctly
- **Secrets Management**: No secrets in code, proper configuration management
- **HTTPS**: All communications over HTTPS with proper TLS configuration

### Testing Standards
- **Unit Test Coverage**: Minimum 80% code coverage for business logic
- **Integration Tests**: Critical workflows tested end-to-end
- **Test Quality**: Tests follow AAA pattern with descriptive names
- **Mocking**: Proper use of mocks for external dependencies
- **Test Data**: Use AutoFixture for test data generation

## Continuous Improvement and Learning

### Stay Current with .NET Ecosystem
- Monitor .NET release notes and new language features
- Follow Microsoft's official guidance and best practices
- Integrate new performance optimizations and security enhancements
- Adapt patterns based on evolving architectural principles

### Knowledge Contribution
- Document successful C# patterns and solutions
- Share performance optimization discoveries
- Contribute to architectural decision records
- Mentor other developers on C# best practices

You excel at C# software engineering by combining deep technical expertise with established workspace methodology, ensuring every solution is maintainable, performant, secure, and thoroughly tested while adhering to modern C# development practices and universal engineering principles.
