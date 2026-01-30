---
name: godot-standards
description: GDScript coding standards, Godot 4.5-specific patterns, scene architecture, signal handling, node lifecycle, and mobile-optimized patterns. Use when writing or reviewing GDScript code, building scenes, implementing systems, or handling Godot editor workflows.
---

# Godot 4.5 Development Standards & Patterns

## Godot Development Workflow - CRITICAL

**ALWAYS follow this workflow when making Godot changes:**

### Before ANY commits involving Godot:
1. **SAVE IN GODOT EDITOR FIRST**
   - File → Save Scene (Ctrl+S) for each modified scene
   - File → Save All (Ctrl+Shift+S) to save all open scenes
   - Then: Check `git status` to see what Godot changed

### Godot-Specific Considerations:
- Scene files (.tscn) only update when saved in Godot Editor
- Script files (.gd) auto-save in editor but require editor refresh if modified externally
- .uid files are auto-generated metadata - always commit them with their corresponding files
- .godot/ folder contains editor cache and imports - never commit (already in .gitignore)
- gdshader files (.gdshader) are compiled by Godot - commit source only
- Resource files (.tres) only update when saved in Godot Editor

### Testing in Godot 4.5:
- User tests changes by pressing F5 (Play) in Godot Editor
- Output window shows print() output and errors
- Compile errors prevent Play mode - must fix first
- Scene panel shows node hierarchy, viewport shows visual representation
- GDScript debugger breakpoints work when Play is active
- Remote tab shows live values during gameplay

### Common Godot Pitfalls:
- Signal connections made in editor persist even if code is deleted
- NodePath properties reference nodes that may not exist if nodes are renamed
- @export variables must have type hints or @export won't work
- await calls outside async context will cause runtime errors
- Circular signal connections can cause infinite loops
- Comparing floats with == can fail due to precision - use is_equal_approx()

---

## GDScript Language Fundamentals

### Naming Conventions (PEP 8 inspired)
- **Classes/Types**: `PascalCase` (GameManager, FactoryController)
- **Functions/Methods**: `snake_case` (process_task, update_worker_position)
- **Constants**: `SCREAMING_SNAKE_CASE` (MAX_WORKERS, TICK_INTERVAL)
- **Properties (private)**: `_snake_case` (leading underscore)
- **Enums**: `PascalCase` for type, `SCREAMING_SNAKE_CASE` for values
- **Signals**: `snake_case` (worker_spawned, task_completed)

### Type Hints (Strongly Encouraged)
```gdscript
# Always use type hints for clarity and error detection
func process_task(task: Task) -> bool:
    if task == null:
        return false
    return execute(task)

# Node type hints are specific
var worker: Worker
var timer: Timer
var container: Container

# Function return types
func calculate_efficiency() -> float:
    return 0.85
```

### Modern GDScript Features (4.5+)
- Use type hints everywhere for runtime safety
- Leverage @onready for node initialization
- Use signal decorators (@export_group, @export_category)
- Apply @rpc annotations for multiplayer (if needed)
- Use built-in string formatting with f-strings (v4.2+)
- Prefer const for compile-time constants

### Error Handling Pattern
```gdscript
# Use early returns and descriptive messages
func load_save_data(save_path: String) -> SaveData:
    if not FileAccess.file_exists(save_path):
        push_warning("Save file not found: %s, starting fresh" % save_path)
        return create_default_save()

    if not save_path.ends_with(".json"):
        push_error("Invalid save file format: %s" % save_path)
        return null

    var file = FileAccess.open(save_path, FileAccess.READ)
    if FileAccess.get_open_error() != OK:
        push_error("Failed to read save file: %s" % save_path)
        return null

    var json = JSON.new()
    var error = json.parse(file.get_as_text())
    if error != OK:
        push_error("JSON parse error in save file")
        return null

    return parse_json_to_save_data(json.data)
```

---

## Godot Architecture Patterns

### Node Hierarchy & Scene Structure
```
Main (Node)
├── GameManager (Autoload singleton)
├── TimeManager (Autoload singleton)
├── UI (CanvasLayer)
│   ├── HUD (Control)
│   ├── Pause Menu (Control)
│   └── Tutorial UI (Control)
├── GameWorld (Node2D or Node3D)
│   ├── Factory (Node2D for grid)
│   │   ├── Machines[0..N] (Node2D instances)
│   │   ├── Workers[0..N] (Node2D instances)
│   │   └── StorageZones (Node2D)
│   └── Camera (Camera2D)
└── AudioManager (Autoload singleton)
```

### Autoload Singletons (Critical System Managers)
Always define in Project Settings → Autoload for persistent, globally-accessible systems:

```gdscript
# Example: GameManager.gd (Autoload)
extends Node

var current_game_state: GameState
var save_system: SaveSystem

func _ready() -> void:
    # Initialize critical systems
    save_system = SaveSystem.new()
    load_game()

func save_game() -> void:
    save_system.write_save_data(current_game_state)

func load_game() -> void:
    current_game_state = save_system.load_save_data()
```

### Scene and Script Organization
- **One script per scene** (attach to root node or use extension scripts)
- **Script name matches scene name** (Machine.gd for Machine.tscn)
- **Keep script logic focused** on that scene's responsibility
- **Use composition over inheritance** (prefer aggregation of systems)
- **Separate concerns**: UI logic separate from game logic

### Signal-Driven Architecture
Signals are Godot's event system - use extensively for decoupling:

```gdscript
# Define signals at the top of your script
signal task_completed(task: Task)
signal worker_spawned(worker: Worker)
signal priority_changed(priority_level: int)

# Emit signals when events happen
func complete_task(task: Task) -> void:
    task.mark_complete()
    task_completed.emit(task)

# Connect signals in _ready()
func _ready() -> void:
    task_queue.task_completed.connect(_on_task_completed)
    worker_spawned.connect(ui_controller._on_worker_spawned)

func _on_task_completed(task: Task) -> void:
    print("Task completed: %s" % task.name)
```

### Node Lifecycle (@onready, _ready, _process)
```gdscript
extends Node2D

# Automatically initialized when scene loads (no null checks needed)
@onready var animation: AnimatedSprite2D = $Sprite
@onready var timer: Timer = $Timer
@onready var children: Array = get_children()

func _ready() -> void:
    # Called when node enters scene tree - ONE TIME ONLY
    # Safe to access other nodes, initialize connections
    timer.timeout.connect(_on_timer_timeout)
    process_mode = ProcessMode.INHERIT  # Default, processes when parent does

func _process(delta: float) -> void:
    # Called every frame (delta = frame time in seconds)
    # Use for continuous updates (movement, animations)
    update_position(delta)

func _physics_process(delta: float) -> void:
    # Called every physics frame (fixed timestep)
    # Use for physics-based updates
    apply_gravity(delta)

func _on_timer_timeout() -> void:
    # Signal callback - execute logic when triggered
    print("Timer fired!")
```

### @export Variables (Inspector Configuration)
```gdscript
extends Node

# Basic @export (auto-detects type from assignment)
@export var speed: float = 100.0
@export var max_workers: int = 10
@export var machine_name: String = "Factory Machine"

# With resource hints for file selection
@export var config_file: Resource

# Group for organization in Inspector
@export_group("Movement")
@export var acceleration: float = 10.0
@export var max_velocity: float = 300.0

@export_group("Combat")
@export var health: int = 100
@export var damage: float = 25.5
```

---

## Mobile & Performance Optimization

### Mobile-First Design
- **Use Area2D for touch detection** (not colliders for clicks)
- **Optimize draw calls** - batch similar objects when possible
- **Profile on target device** - mobile has different performance envelope
- **Use lower-poly assets** for mobile targets
- **Cache frequently-accessed nodes** with @onready

### Performance Patterns
```gdscript
# BAD: Creates new object every frame
func _process(delta: float) -> void:
    var new_vector = Vector2(input.x, input.y)  # Allocates memory

# GOOD: Reuse objects, use built-in methods
func _process(delta: float) -> void:
    position += input_direction * speed * delta

# BAD: Searches entire tree every frame
func _process(delta: float) -> void:
    var target = get_tree().get_first_node_in_group("enemies")

# GOOD: Cache reference
func _ready() -> void:
    enemies_group = get_tree().get_nodes_in_group("enemies")

func _process(delta: float) -> void:
    for enemy in enemies_group:
        update_target(enemy)
```

### Pooling for Frequently-Created Objects
```gdscript
# Node pooling for bullets, particles, etc.
class_name ObjectPool
extends Node

var available: Array = []
var in_use: Array = []
var prefab: PackedScene

func _init(prefab_path: String, pool_size: int) -> void:
    prefab = load(prefab_path)
    for i in range(pool_size):
        var obj = prefab.instantiate()
        obj.hide()
        add_child(obj)
        available.append(obj)

func get_object() -> Node:
    if available.is_empty():
        return prefab.instantiate()

    var obj = available.pop_back()
    obj.show()
    in_use.append(obj)
    return obj

func return_object(obj: Node) -> void:
    obj.hide()
    in_use.erase(obj)
    available.append(obj)
```

---

## Free Enterprise Tycoon Specific Patterns

### Tick-Based Time System
The game uses a custom tick system (not delta time):

```gdscript
# TimeManager.gd (Autoload)
extends Node

signal tick_advanced
signal day_started
signal day_ended

const TICK_INTERVAL: float = 2.0  # 2 real seconds = 15 game minutes
const TICKS_PER_DAY: int = 36     # 36 ticks = 9 game hours

var current_tick: int = 0
var current_game_minute: int = 0  # 8:00 AM is minute 0
var is_night: bool = false

func _ready() -> void:
    var timer = Timer.new()
    add_child(timer)
    timer.wait_time = TICK_INTERVAL
    timer.timeout.connect(_on_tick)
    timer.start()

func _on_tick() -> void:
    current_tick += 1
    current_game_minute += 15
    tick_advanced.emit()

    if current_tick >= TICKS_PER_DAY:
        _transition_to_night()
        current_tick = 0

func _transition_to_night() -> void:
    is_night = true
    day_ended.emit()
    # Workers stop working, machines stop processing
    await get_tree().create_timer(1.0).timeout
    _start_new_day()

func _start_new_day() -> void:
    is_night = false
    day_started.emit()
```

### Task Queue Pattern
```gdscript
# TaskQueue.gd (Autoload)
extends Node

class_name TaskQueue

signal task_assigned(task: Task)
signal task_completed(task: Task)

var tasks: Array[Task] = []
var active_tasks: Dictionary = {}  # worker_id: Task

func add_task(task: Task) -> void:
    tasks.append(task)
    _assign_if_available()

func _assign_if_available() -> void:
    for task in tasks:
        if task.assigned_to == null:
            var worker = _find_available_worker()
            if worker != null:
                task.assigned_to = worker
                active_tasks[worker.id] = task
                task_assigned.emit(task)
                break

func complete_task(task: Task) -> void:
    tasks.erase(task)
    active_tasks.erase(task.assigned_to.id)
    task_completed.emit(task)
```

### Worker & Machine Pattern
```gdscript
# Worker.gd
extends Node2D

signal task_started
signal task_completed

var current_task: Task = null
var position_offset: Vector2 = Vector2.ZERO

func _ready() -> void:
    TimeManager.tick_advanced.connect(_on_tick)

func assign_task(task: Task) -> void:
    current_task = task
    task_started.emit()
    await execute_task()

func execute_task() -> void:
    # Execute based on task type
    match current_task.task_type:
        Task.Type.LOAD:
            move_to_input_zone()
            load_materials()
        Task.Type.OPERATE:
            move_to_machine()
            operate_machine()
        Task.Type.UNLOAD:
            move_to_output_zone()
            unload_materials()

    task_completed.emit()
```

---

## Common Godot Functions Reference

### Essential Node Methods
```gdscript
# Finding nodes
get_node("path/to/node")           # Get by path
find_child("name", true, false)    # Recursive search
get_tree().get_nodes_in_group("tag")  # By group tag

# Scene tree manipulation
add_child(node)
remove_child(node)
queue_free()                        # Schedule for deletion (safe)

# Signals
signal.connect(callback)
signal.disconnect(callback)
signal.emit(arguments)

# Groups (tags for organizing nodes)
add_to_group("enemies")
is_in_group("enemies")
get_tree().call_group("enemies", "function_name")

# Properties
get_property_list()
set_meta("key", value)
get_meta("key")
```

### Input Handling (Mobile Touch)
```gdscript
func _input(event: InputEvent) -> void:
    if event is InputEventScreenTouch:
        if event.pressed:
            _on_touch_started(event.position)
        else:
            _on_touch_released(event.position)

    if event is InputEventScreenDrag:
        _on_touch_dragged(event.position, event.relative)

func _on_touch_started(position: Vector2) -> void:
    # Check if touch hit interactive area
    var areas = get_tree().get_nodes_in_group("touchable")
    for area in areas:
        if area.get_node("CollisionShape2D").shape.contains_point(position):
            area.handle_touch(position)
```

### Common Patterns for Async/Await
```gdscript
# Wait for signal
await signal_source.signal_name
await task_queue.task_completed

# Wait for timer
await get_tree().create_timer(2.0).timeout

# Wait for next frame
await get_tree().process_frame

# Tween animations
var tween = create_tween()
tween.tween_property(node, "position", Vector2(100, 200), 1.0)
tween.tween_callback(on_animation_complete)
```

---

## Token-Efficient Implementation Strategy

When asking for implementation help:

1. **Reference specific systems**: "Implement the Worker assignment logic in TaskQueue.gd:45"
2. **One system at a time**: Don't ask for entire managers, focus on single features
3. **Provide context**: "We use tick-based time (2 real seconds = 15 game minutes)"
4. **Request incremental**: "Start with basic task assignment, we'll add priority sorting later"
5. **Scene references**: Provide the .tscn structure when adding UI elements

### Code Reuse Patterns
- **Autoload Singletons**: Access from anywhere with `ManagerName.method()`
- **Signals**: Use for system-to-system communication (decoupling)
- **Groups**: Use tags to organize related nodes
- **Compose, don't inherit**: Create manager objects that operate on other objects
