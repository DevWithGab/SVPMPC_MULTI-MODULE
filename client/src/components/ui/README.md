# Shared workspace UI

Attendance and Mortuary use the same components and tokens. Change shared
appearance in `design-system.css`, rather than adding another page-specific
version of a header, table, field or dialog.

- `workspace.jsx`: `PageHeader`, `Panel`, `PanelHeader`, `FormField`,
  `ModalActions`, `DialogHeader` and `SearchField`.
- `button.jsx`: `Button`, with `default`, `outline`, `destructive`, `ghost`,
  `secondary` and `link` variants. `sm`, `lg` and `icon` sizes are supported.
- `input.jsx`: `Input`, `Textarea` and `Select` with the same focus, disabled,
  validation and read-only appearance.
- Use `SearchField` around an icon and `<Input unstyled />` so a search field has one border and one focus ring.
- `table.jsx`: `Table` and the standard table parts. Keep wide tables inside
  an existing horizontal scroll region. Print layouts retain their print CSS.
- `modal.jsx`: `Modal` with a title, optional description, `maxWidth`, children
  and optional footer. Focus trapping, Escape, body scrolling and focus return
  are shared. Native top-layer dialogs use `DialogHeader` and `ModalActions`
  while preserving their existing lifecycle.

```jsx
<PageHeader eyebrow="Mortuary management / Members" title="Members"
  description="Review registered members." actions={<Button>Add member</Button>} />

<Panel>
  <PanelHeader><div><h2>Member records</h2><p>Current records on file.</p></div></PanelHeader>
  {/* Existing table or page content */}
</Panel>

<Modal isOpen={open} onClose={close} title="Update member" maxWidth="max-w-lg">
  <form onSubmit={save}>
    <FormField label="Name" required error={error}>
      <Input value={name} onChange={event => setName(event.target.value)} />
    </FormField>
    <ModalActions>
      <Button type="button" variant="outline" onClick={close}>Cancel</Button>
      <Button type="submit">Save changes</Button>
    </ModalActions>
  </form>
</Modal>
```

Legacy imports in `shared/ui` and `mortuary/shared/Modal` delegate to these
components. Keep those adapters for compatibility; new screens should import
from this directory. Existing page-specific classes should handle layout or
workflow details, not redefine the shared visual rules.
