---
name: radix-ui
description: "Modern, accessible UI component library for React apps. Use this skill whenever the user needs to build or work with React interfaces — building dashboards, forms, landing pages, data-rich applications, or any interactive UI. Radix UI provides pre-styled components (Button, Card, Dialog, Dropdown, Form, Table, etc.) with built-in accessibility, theming via CSS variables, and dark mode support. Triggers on: 'component library', 'UI library', 'accessible components', 'React components', 'Radix', 'pre-styled components', designing interfaces, building dashboards, creating forms, data tables, or when the user asks about theming or accessibility in React."
compatibility: "React 16.8+, Node.js 14+, npm/yarn/bun"
---

# Radix UI Themes

Modern, accessible component library for React applications. Pre-styled, production-ready components with customizable theming and dark mode support out of the box.

## When to Use This Skill

Use Radix UI Themes when:
- **Building interfaces** — dashboards, admin panels, data tables, forms
- **Need accessible components** — fully WCAG-compliant out of the box
- **Customizing theme** — colors, spacing, radius, typography
- **Implementing dark mode** — built-in support via CSS variables
- **Multi-component UI** — buttons, cards, dialogs, dropdowns, etc.
- **Want rapid development** — ship styled UIs without custom CSS

Skip Radix UI if you need very unique branding that diverges significantly from the theme system, or if you're working with a different UI framework (Vue, Svelte, etc.).

## Setup

### 1. Install the Package

```bash
npm install @radix-ui/themes
# or
bun add @radix-ui/themes
```

### 2. Import Styles

Add to your application entry point (e.g., `src/main.tsx`, `pages/_app.tsx`):

```typescript
import "@radix-ui/themes/styles.css";
```

### 3. Wrap Your App with Theme

```typescript
import { Theme } from "@radix-ui/themes";

export default function App() {
  return (
    <Theme>
      <YourApp />
    </Theme>
  );
}
```

### 4. Start Using Components

```typescript
import { Button, Flex, Text } from "@radix-ui/themes";

export function MyComponent() {
  return (
    <Flex direction="column" gap="4">
      <Text as="h1" size="9" weight="bold">
        Hello Radix UI
      </Text>
      <Button>Click me</Button>
    </Flex>
  );
}
```

---

## Core Concepts

### Theme Wrapper

The `<Theme>` component is the root container that enables theming across your app. All Radix components inside `<Theme>` inherit theme settings.

```typescript
<Theme appearance="dark" accentColor="blue" grayColor="slate">
  <App />
</Theme>
```

### Theme Props

Pass these props to `<Theme>` to customize appearance:

| Prop | Type | Default | Purpose |
|------|------|---------|---------|
| `appearance` | `"light"` \| `"dark"` | `"light"` | Light or dark mode |
| `accentColor` | string | `"blue"` | Primary brand color |
| `grayColor` | string | `"gray"` | Neutral gray scale |
| `radius` | `"none"` \| `"small"` \| `"medium"` \| `"large"` \| `"full"` | `"medium"` | Corner radius |
| `scaling` | `"90%"` \| `"95%"` \| `"100%"` \| `"105%"` \| `"110%"` | `"100%"` | UI scale |
| `suppressHydrationWarning` | boolean | — | For SSR apps |

### Available Colors

**Accent colors:** amber, blue, bronze, brown, crimson, cyan, gold, grass, indigo, iris, jade, lime, mint, olive, orange, pink, plum, purple, red, ruby, sky, teal, tomato, violet, yellow

**Gray colors:** gray, mauve, olive, sage, sand, slate

---

## Common Components

### Layout Components

**`Flex`** — Flexible box layout
```typescript
<Flex direction="column" gap="3" align="start">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</Flex>
```

**`Grid`** — CSS Grid layout
```typescript
<Grid columns="3" gap="4">
  <Box>Column 1</Box>
  <Box>Column 2</Box>
  <Box>Column 3</Box>
</Grid>
```

**`Section`** — Page section container
```typescript
<Section>
  <Container>Content goes here</Container>
</Section>
```

### Typography

**`Text`** — Text with size, weight, color options
```typescript
<Text as="p" size="3" weight="medium" color="gray">
  This is a paragraph
</Text>
```

**`Heading`** — Semantic heading
```typescript
<Heading as="h1" size="8">
  Main Title
</Heading>
```

### Interactive Components

**`Button`** — Primary action button
```typescript
<Button onClick={handleClick}>
  Click me
</Button>
```

**`TextField`** — Text input field
```typescript
<TextField.Root>
  <TextField.Input placeholder="Enter text..." />
</TextField.Root>
```

**`Dialog`** — Modal dialog
```typescript
<Dialog.Root>
  <Dialog.Trigger asChild>
    <Button>Open Dialog</Button>
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Confirm Action</Dialog.Title>
    <Dialog.Description>Are you sure?</Dialog.Description>
    <Dialog.Close asChild>
      <Button>Close</Button>
    </Dialog.Close>
  </Dialog.Content>
</Dialog.Root>
```

**`DropdownMenu`** — Dropdown menu
```typescript
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <Button>Actions</Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item>Edit</DropdownMenu.Item>
    <DropdownMenu.Item>Delete</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

### Data Display

**`Table`** — Data table with sorting, pagination
```typescript
<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
      <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    <Table.Row>
      <Table.Cell>John Doe</Table.Cell>
      <Table.Cell>Active</Table.Cell>
    </Table.Row>
  </Table.Body>
</Table.Root>
```

**`Card`** — Content container
```typescript
<Card>
  <Flex direction="column" gap="3">
    <Heading>Card Title</Heading>
    <Text>Card content here</Text>
  </Flex>
</Card>
```

**`Badge`** — Status badge
```typescript
<Badge color="green">Active</Badge>
<Badge color="red">Inactive</Badge>
```

---

## Styling & Customization

### CSS Variables

Radix UI uses CSS variables for theming. Access them in custom CSS:

```css
:root {
  --accent-9: var(--accent-9);  /* Dark accent color */
  --gray-3: var(--gray-3);      /* Light gray */
}
```

### Sizing System

All components use a 0-9 scale for sizing. `size="1"` is smallest, `size="9"` is largest.

```typescript
<Text size="2">Small text</Text>
<Text size="5">Medium text</Text>
<Text size="9">Large heading</Text>
```

### Spacing

Gap and padding use a 1-9 scale (1 = 0.25rem, 9 = 2rem):

```typescript
<Flex gap="3" p="4">
  {/* 3 = 0.75rem gap, 4 = 1rem padding */}
</Flex>
```

### Custom CSS

Combine Radix components with custom CSS:

```typescript
// MyComponent.tsx
import * as styles from "./MyComponent.module.css";

export function MyComponent() {
  return (
    <Flex className={styles.container}>
      <Text>Custom styled content</Text>
    </Flex>
  );
}
```

```css
/* MyComponent.module.css */
.container {
  border: 2px solid var(--accent-7);
  border-radius: var(--radius-4);
  padding: var(--space-4);
}
```

---

## Dark Mode

Radix UI automatically handles dark mode via the `appearance` prop on `<Theme>`:

```typescript
const [isDark, setIsDark] = useState(false);

<Theme appearance={isDark ? "dark" : "light"}>
  <App />
</Theme>
```

Or use CSS media query:

```typescript
<Theme appearance="inherit">
  {/* Inherits system preference via prefers-color-scheme */}
</Theme>
```

---

## ThemePanel

Use `ThemePanel` during development to preview theme changes in real-time:

```typescript
import { Theme, ThemePanel } from "@radix-ui/themes";

export default function App() {
  return (
    <Theme>
      <ThemePanel />
      <YourApp />
    </Theme>
  );
}
```

**Important:** Remove `<ThemePanel>` before shipping to production.

---

## Common Patterns

### Responsive Layouts

```typescript
<Flex
  direction={{ initial: "column", sm: "row" }}
  gap={{ initial: "2", sm: "4" }}
>
  <Box flexGrow="1">Sidebar</Box>
  <Box flexGrow="2">Main content</Box>
</Flex>
```

### Form with Validation

```typescript
import { TextField, Button, Text } from "@radix-ui/themes";

export function ContactForm() {
  const [error, setError] = useState("");

  return (
    <Flex direction="column" gap="3">
      <TextField.Root>
        <TextField.Slot>Name</TextField.Slot>
        <TextField.Input placeholder="Your name" />
      </TextField.Root>
      {error && <Text color="red">{error}</Text>}
      <Button onClick={() => setError("")}>Submit</Button>
    </Flex>
  );
}
```

### Modal Dialog

```typescript
import { Dialog, Button, TextField } from "@radix-ui/themes";

export function CreateDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button>New Item</Button>
      </Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>Create New Item</Dialog.Title>
        <TextField.Root>
          <TextField.Input placeholder="Item name" />
        </TextField.Root>
        <Flex gap="3" justify="end">
          <Dialog.Close asChild>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button>Create</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

---

## Component Variants

Most components support style variants:

```typescript
<Button variant="solid">Solid (default)</Button>
<Button variant="soft">Soft</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>

<TextField variant="classic" />
<TextField variant="soft" />
<TextField variant="surface" />

<Card variant="classic" />
<Card variant="surface" />
```

---

## Props Reference

Most Radix components accept these common props:

| Prop | Type | Purpose |
|------|------|---------|
| `size` | `"1"` to `"9"` | Component size |
| `color` | string | Color override |
| `variant` | string | Visual style variant |
| `gap` | number \| object | Spacing between children |
| `p` / `px` / `py` | number | Padding (all/x/y) |
| `m` / `mx` / `my` | number | Margin (all/x/y) |
| `flexGrow` / `flexShrink` | number | Flex grow/shrink |
| `align` | string | Alignment |
| `justify` | string | Justification |
| `asChild` | boolean | Replace with child element |

---

## Accessibility

Radix UI components come fully WCAG 2.1 AA compliant:

- **Keyboard navigation** — All interactive components work with Tab, Enter, Escape
- **Screen readers** — Proper ARIA labels and roles
- **Focus management** — Dialogs trap focus, menus close on escape
- **Color contrast** — Meets AA standards by default
- **Semantic HTML** — Uses correct HTML elements

You rarely need to add extra accessibility code — it's built in.

---

## Troubleshooting

### Components not styled

❌ **Problem:** Components appear unstyled
✅ **Solution:** Ensure `@radix-ui/themes/styles.css` is imported at the app entry point

### Dark mode not working

❌ **Problem:** Dark mode toggle doesn't apply styles
✅ **Solution:** Use `appearance` prop on `<Theme>` or wrap your app in `<Theme appearance="inherit">`

### TypeScript errors

❌ **Problem:** Missing types for Radix components
✅ **Solution:** Install `@radix-ui/themes` which includes full TypeScript definitions

### SSR hydration mismatch

❌ **Problem:** "Hydration mismatch" error with Next.js/SSR
✅ **Solution:** Add `suppressHydrationWarning` to `<Theme>` component:
```typescript
<Theme suppressHydrationWarning>
  <App />
</Theme>
```

---

## Resources

- **Official Docs:** https://www.radix-ui.com/themes/docs
- **Component API:** Browse each component's props and usage
- **Color System:** Full documentation on accent and gray colors
- **Figma Kit:** Design system file for prototyping (optional)
- **Examples:** Community examples and templates

---

## Next Steps

1. **Install** the package with `npm install @radix-ui/themes`
2. **Import styles** in your app entry point
3. **Wrap your app** with `<Theme>`
4. **Start building** — import components and begin constructing your UI
5. **Customize** via `accentColor`, `grayColor`, and other Theme props
6. **Use ThemePanel** during development to experiment with themes
