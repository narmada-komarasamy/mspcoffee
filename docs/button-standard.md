# MSP Coffee button standard

Approved by Ashok Rajes on 12/11/2026 from the HO Fuel upload preview.

- Primary actions and uploads: green #4a9e4a, white bold text, hover #2d6e2d.
- Secondary actions, including read/review/clear: cream #f4efdd, border #e2dbc2, dark muted text #596357.
- Use a modest 6px corner radius, comfortable padding, clear action labels and visible keyboard focus. Upload controls have a 44px minimum touch target.
- Use an upload icon and a visible button, such as **Upload Bill**, rather than unstyled file-picker text. Display file status alongside it and file names after upload.
- Keep destructive actions red and preserve distinct navigation/tab states.
- Reuse `FileUploadButton` for new upload controls; it supports PDF/image filters, multiple selection, disabled state and existing upload handlers.
- Reuse `Button` default/secondary variants or the global `msp-action-button` / `msp-action-button--secondary` classes for custom action controls.
- Native file selectors throughout the app receive the same green treatment through the global stylesheet. Existing custom upload workflows retain their existing handlers and limits.

HO Fuel uses the named upload action, with the cream **Read bill and fill details** action below it. Uploading automatically reads new purchase bills; the secondary action retries reading attached bills. Review remains required before saving.
