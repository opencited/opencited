# Input Handling

Patterns for handling keyboard input in Ink.js applications.

## Overview

Keyboard input is the primary interaction method in CLI applications. Ink.js provides the `useInput` hook for handling key presses, but managing multiple input handlers requires careful coordination.

## useInput Basics

```typescript
import { useInput, useApp } from "ink";

const MyComponent: React.FC = () => {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === "q") {
      exit();
    }

    if (key.upArrow) {
      // Handle up arrow
    }

    if (key.downArrow) {
      // Handle down arrow
    }

    if (key.return) {
      // Handle Enter
    }
  });

  return <Text>Press 'q' to quit</Text>;
};
```

## Key Object Properties

```typescript
interface Key {
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageDown: boolean;
  pageUp: boolean;
  return: boolean;
  escape: boolean;
  ctrl: boolean;
  shift: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  meta: boolean;  // Command on macOS
}
```

## useAppInput Hook

Create a global input handler for app-wide shortcuts:

```typescript
import { useInput, useApp } from "ink";

interface AppInputOptions {
  onExit?: () => void;
  onHelp?: () => void;
  disabled?: boolean;
}

export function useAppInput(options: AppInputOptions = {}) {
  const { exit } = useApp();
  const { onExit, onHelp, disabled = false } = options;

  useInput((input, key) => {
    if (disabled) return;

    // Ctrl+C to exit
    if (key.ctrl && input === "c") {
      onExit?.();
      exit();
      return;
    }

    // ? for help
    if (input === "?") {
      onHelp?.();
      return;
    }
  });
}
```

## Multiple useInput Coordination

### Problem: All Handlers Fire

```typescript
// Problem: Both handlers receive every key press
const Parent: React.FC = () => {
  useInput((input, key) => {
    console.log("Parent received:", input);
  });

  return <Child />;
};

const Child: React.FC = () => {
  useInput((input, key) => {
    console.log("Child received:", input); // Also fires!
  });

  return <Text>Child</Text>;
};
```

### Solution 1: Early Return Pattern

```typescript
const Screen: React.FC<{ active: boolean }> = ({ active }) => {
  useInput((input, key) => {
    if (!active) return; // Skip if not active

    // Handle input only when active
  });
};
```

### Solution 2: isActive Option

```typescript
const InteractiveElement: React.FC<{ focused: boolean }> = ({ focused }) => {
  useInput(
    (input, key) => {
      // Only fires when focused is true
    },
    { isActive: focused }
  );
};
```

### Solution 3: blockKeys Pattern

For modal dialogs that should block parent input:

```typescript
interface ModalProps {
  onClose: () => void;
  blockKeys?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ onClose, blockKeys = true }) => {
  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  }, { isActive: blockKeys });

  // Consume all keys when blocking
  useInput(() => {}, { isActive: blockKeys });

  return <Box>Modal Content</Box>;
};
```

## Enter Double-Press Prevention

### Problem

First render may buffer an Enter press from the previous command:

```typescript
// User types: node cli.js↵
// Enter key is captured by the first useInput
```

### Solution: Buffer First Frame

```typescript
import { useState, useEffect } from "react";

export function useInputWithBuffer() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for first frame to complete
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return ready;
}

// Usage
const SelectScreen: React.FC = () => {
  const ready = useInputWithBuffer();

  useInput((input, key) => {
    if (!ready) return; // Ignore buffered input

    if (key.return) {
      // Safe to handle Enter
    }
  });
};
```

## Filter Mode Toggle

Implement filter/search mode:

```typescript
type InputMode = "navigation" | "filter";

export const FilterableList: React.FC = () => {
  const [mode, setMode] = useState<InputMode>("navigation");
  const [filterText, setFilterText] = useState("");

  useInput((input, key) => {
    if (mode === "navigation") {
      if (input === "/") {
        setMode("filter");
        return;
      }

      if (key.upArrow || key.downArrow) {
        // Navigate list
      }
    }

    if (mode === "filter") {
      if (key.escape) {
        setMode("navigation");
        setFilterText("");
        return;
      }

      if (key.return) {
        setMode("navigation");
        // Apply filter
        return;
      }

      if (key.backspace) {
        setFilterText(prev => prev.slice(0, -1));
        return;
      }

      // Printable character
      if (input && input.length === 1) {
        setFilterText(prev => prev + input);
      }
    }
  });

  return (
    <Box flexDirection="column">
      {mode === "filter" && (
        <Text>Filter: {filterText}_</Text>
      )}
      {/* List items */}
    </Box>
  );
};
```

## Keyboard Shortcut Groups

Organize shortcuts by context:

```typescript
const SHORTCUTS = {
  global: {
    "ctrl+c": "Exit",
    "?": "Help",
  },
  list: {
    "↑/↓": "Navigate",
    "Enter": "Select",
    "/": "Filter",
    "a": "Select all",
    "d": "Deselect all",
  },
  editor: {
    "Escape": "Cancel",
    "ctrl+s": "Save",
  },
} as const;

export const ShortcutHelp: React.FC<{ context: keyof typeof SHORTCUTS }> = ({
  context,
}) => {
  const shortcuts = SHORTCUTS[context];

  return (
    <Box flexDirection="column">
      {Object.entries(shortcuts).map(([key, desc]) => (
        <Text key={key}>
          <Text bold>{key}</Text>: {desc}
        </Text>
      ))}
    </Box>
  );
};
```

## Focus Management

Coordinate input between focusable elements:

```typescript
import { useFocus, useFocusManager } from "ink";

const FocusableInput: React.FC<{
  id: string;
  onSubmit: (value: string) => void;
}> = ({ id, onSubmit }) => {
  const { isFocused } = useFocus({ id });
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.return) {
      onSubmit(value);
      return;
    }

    if (key.backspace) {
      setValue(prev => prev.slice(0, -1));
      return;
    }

    if (input) {
      setValue(prev => prev + input);
    }
  }, { isActive: isFocused });

  return (
    <Box borderStyle={isFocused ? "single" : "round"}>
      <Text>{value || "Type here..."}</Text>
    </Box>
  );
};
```

## Special Key Combinations

```typescript
useInput((input, key) => {
  // Ctrl+C
  if (key.ctrl && input === "c") { /* ... */ }

  // Ctrl+S
  if (key.ctrl && input === "s") { /* ... */ }

  // Shift+Tab (reverse tab)
  if (key.shift && key.tab) { /* ... */ }

  // Meta+Enter (Command+Enter on macOS)
  if (key.meta && key.return) { /* ... */ }

  // Alt+Up (may not work in all terminals)
  if (key.meta && key.upArrow) { /* ... */ }
});
```

## Best Practices

1. **Use isActive option** - Disable input when component is inactive
2. **Buffer first frame** - Prevent capturing Enter from shell command
3. **Implement early returns** - Check conditions before handling
4. **Show available shortcuts** - Display help in footer
5. **Group shortcuts by context** - Different modes have different keys
6. **Handle Ctrl+C explicitly** - Set `exitOnCtrlC: false` and manage exit
7. **Support Escape for cancel** - Consistent back/cancel behavior
8. **Use focus management** - Coordinate between interactive elements
