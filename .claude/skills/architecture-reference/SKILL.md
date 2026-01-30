---
name: architecture-reference
description: Technical architecture guide for Free Enterprise Tycoon including core systems, data structures, scene organization, and design decisions. Use when understanding system design, data models, or machine specifications.
---

# Architecture Reference

## Project Overview

**Project**: Mobile idle factory management game (Unity 6, Android)
**Monetization**: Free + IAP (cosmetics, QoL, ad removal)
**MVP Goal**: Single tutorial level (Plastic Case machine, basic production loop)
**Timeline**: Proof of life ASAP, then iterative

### Key Constraints
- Solo dev + AI assistance (limited tokens)
- No graphics/audio skills → Placeholders (primitives) for MVP
- C# knowledge but no Unity experience
- Mobile-first touch controls required

---

## Technical Architecture

### Core Systems (C# Scripts)

#### Data Models (ScriptableObjects)
- `MachineDefinition`: Machine stats, inputs/outputs, worker slots
- `MaterialDefinition`: Material name, base price, stack size
- `WorkerDefinition` (future): Skills, personality (abstract for MVP)

#### Managers (Singletons)
- `GameManager`: Game state, level loading, save/load
- `FactoryManager`: Factory grid, placement validation, entity tracking
- `ProductionManager`: Idle simulation, production calculations
- `InventoryManager`: Material tracking, purchasing logic
- `WorkerManager`: Worker roster, assignment tracking
- `UIManager`: Screen management, modal dialogs
- `TimeManager`: Tick-based time, work day cycles
- `TaskQueue`: Dynamic task management
- `WorkerCoordinator`: Worker update loop
- `PriorityController`: Task priority management

#### Systems
- `GridSystem`: Tile-based grid, pathfinding (simple A* for workers)
- `SaveSystem`: JSON serialization, PlayerPrefs for MVP (cloud later)
- `IdleCalculator`: Offline progression formula
- `TutorialSystem`: Step tracking, highlight system

#### Entities (MonoBehaviours)
- `Machine`: Placed machine instance, production logic, task generation
- `Worker`: Worker instance, movement, task execution (visual only for MVP)
- `StorageZone`: Material storage zone, capacity tracking

### Scene Structure
- **MainMenu**: Title screen, continue/new game buttons
- **TutorialFactory**: Pre-built factory layout, tutorial logic
- (Future) **FactoryScene**: Generic factory scene for World 1+ levels

### Folder Structure
```
Assets/
├── Scenes/
│   ├── MainMenu.unity
│   └── TutorialFactory.unity
├── Scripts/
│   ├── Core/
│   │   ├── GameManager.cs
│   │   ├── SaveSystem.cs
│   │   ├── TimeManager.cs
│   │   └── IdleCalculator.cs
│   ├── Factory/
│   │   ├── FactoryManager.cs
│   │   ├── GridSystem.cs
│   │   ├── Machine.cs
│   │   └── StorageZone.cs
│   ├── Production/
│   │   ├── ProductionManager.cs
│   │   ├── InventoryManager.cs
│   │   └── PriorityController.cs
│   ├── Workers/
│   │   ├── WorkerManager.cs
│   │   ├── Worker.cs
│   │   ├── WorkerCoordinator.cs
│   │   ├── WorkTask.cs
│   │   └── TaskQueue.cs
│   ├── UI/
│   │   ├── UIManager.cs
│   │   ├── InventoryPanel.cs
│   │   ├── WorkerPanel.cs
│   │   ├── TimeDisplayUI.cs
│   │   ├── NightOverlayUI.cs
│   │   ├── TaskQueueUI.cs
│   │   ├── MachinePriorityUI.cs
│   │   └── WorkerStatusUI.cs
│   └── Tutorial/
│       └── TutorialSystem.cs
├── ScriptableObjects/
│   ├── Machines/
│   │   └── PlasticCaseMachine.asset
│   └── Materials/
│       ├── Copper.asset
│       ├── Nickel.asset
│       └── PlasticCase.asset
├── Prefabs/
│   ├── Machines/
│   │   └── PlasticCaseMachine.prefab
│   ├── UI/
│   │   └── WorkerAssignmentModal.prefab
│   └── Workers/
│       └── Worker.prefab
├── Sprites/ (Placeholders)
│   ├── machine_placeholder.png
│   └── worker_placeholder.png
└── Materials/ (Unity materials)
    ├── GridTile.mat
    └── MachinePlaceholder.mat
```

---

## Data Structures (C# Reference)

### MachineDefinition (ScriptableObject)
```csharp
[CreateAssetMenu(fileName = "Machine", menuName = "Factory/Machine")]
public class MachineDefinition : ScriptableObject
{
    public string machineName;
    public MachineCategory category;

    [System.Serializable]
    public class InputSlot
    {
        public MaterialDefinition material;
        public int quantity;
    }

    public List<InputSlot> inputs;
    public MaterialDefinition output;
    public int outputQuantity;
    public int productionTimeInTicks;
    public int gridWidth;
    public int gridHeight;
}
```

### MaterialDefinition (ScriptableObject)
```csharp
[CreateAssetMenu(fileName = "Material", menuName = "Factory/Material")]
public class MaterialDefinition : ScriptableObject
{
    public string materialName;
    public MaterialType type;
    public float basePrice;
    public int stackSize;
    public Sprite icon;
}
```

### FactorySaveData (Serializable)
```csharp
[System.Serializable]
public class FactorySaveData
{
    public long lastSaveTimestamp;

    [System.Serializable]
    public class TimeData
    {
        public int currentDay;
        public int currentHour;
        public int currentMinute;
        public long totalTickCount;
        public bool isPaused;
    }
    public TimeData timeData;

    [System.Serializable]
    public class InventoryItem
    {
        public string materialID;
        public int quantity;
    }
    public List<InventoryItem> inventory;

    [System.Serializable]
    public class MachineData
    {
        public string machineID;
        public Vector2Int gridPosition;
        public int rotation;
        public int productionTicksRemaining;
        public int currentState;
        public int defaultPriority;
        public List<string> assignedWorkerIDs;
    }
    public List<MachineData> machines;

    [System.Serializable]
    public class WorkerData
    {
        public string workerID;
        public string workerName;
        public float efficiency;
        public int role;
    }
    public List<WorkerData> workers;

    public float currentCash;
    public int levelID;
}
```

---

## Core Design Decisions

### Time System (Tick-Based)
- **Tick Interval**: 2 real seconds = 15 game minutes
- **Work Day**: 8:00 AM - 5:00 PM (9 hours = 36 ticks/day)
- **Night Handling**: 5-second fast-forward animation, automatic day transition
- **Production Pausing**: Machines pause mid-cycle at 5 PM, resume at 8 AM
- **Worker Schedule**: Arrive exactly 8:00 AM, depart exactly 5:00 PM (no random arrival)
- **2D Factory Access**: Blocked during night hours (17:00 - 08:00)

### Task Queue System
- **Task Generation**: Machines generate tasks when work needed (load, operate, unload, repair)
- **Worker Roles**: Loader, Operator, Unloader, Mechanic (flexible - workers do all tasks)
- **Self-Assignment**: Workers claim tasks from queue based on role + location
- **Priority System**: Tasks have priority levels (Critical, High, Normal, Low)
- **Player Control**: Can adjust task priority to optimize production

### Platform Strategy
1. **Phase 1**: Local saves only (PlayerPrefs/JSON)
2. **Phase 2**: Google Play integration (achievements + cloud saves)
3. **Phase 3**: iOS support (Game Center)
4. **Phase 4**: Monetization (ads + IAP)

---

## Machine Data Reference

### MVP Machine: Plastic Case
- **Inputs**: Copper (raw, 1x), Nickel (raw, 1x)
- **Output**: Plastic Case (component, 1x)
- **Grid Size**: 2x2 tiles
- **Production Time**: 3 ticks per unit (6 real seconds)
- **Worker Roles**: Loader, Operator, Unloader (flexible system)

### Future Machines (World 1)
- Steel Case: Inputs TBD
- Aluminum Case: Inputs TBD
- Basic Radio: Plastic Case + Quartz + PCB
