# Form Block Components

This document describes the rendering pipeline, component decorator system, and view update mechanisms for form components in the AEM Boilerplate Forms project.

## Site Theme and Universal Editor Authoring

The Alstom-inspired theme uses shared tokens in `styles/styles.css` for the brand
palette, typography, spacing, links, buttons, and keyboard focus. It uses the
existing, locally hosted Roboto fonts as an alternative to Alstom's proprietary
heading font; no external font or official brand asset is downloaded at runtime.
Header, footer, hero, cards, and columns keep their existing content models and
instrumentation. Form variables in `blocks/form/form.css` reuse the site palette
without changing rendering, rules, worker messages, or submission endpoints.
Form columns authored through `colspan` remain unchanged on larger screens and
stack at widths below 600px.

The section Style selector exposes `highlight` (existing), `light`, `dark`, and
`contact`. Use one background style per section. The Contact style provides a
light background around introductory content and the form card. Change source
models in `models/_section.json`, then run `npm run build:json`; do not edit the
generated root component JSON files by hand.

Page content and shared fragments are supplied by AEM, not by this repository.
Deploying the theme does not replace existing placeholder text or the Adobe
navigation/footer content. To compose the contact-oriented landing page:

1. In Universal Editor, replace the introductory placeholder section with a Hero.
   Supply an approved railway image, alternative text, one H1, a short introduction,
   and a bold link to the contact section. The hero remains readable without an image.
2. Add a section with an H2 and three Cards for the relevant solutions or services.
   Keep titles and links editable; link only to existing destinations.
3. Optionally add a Dark section with Columns for supporting information and a CTA.
4. Put the contact introduction and existing Adaptive Form in a Contact section.
   Preserve field names, rules, actions, and submission configuration. Set the
   contact section's anchor in AEM and use that actual anchor for CTA links.
5. Edit `/nav` (brand, navigation, tools) and `/footer`, or the paths supplied by
   the page's `nav` and `footer` metadata. Replace the sample brand and Adobe
   copyright with approved content. Use a licensed logo and appropriate image
   variants for light and dark backgrounds.
6. Preview the page and fragments, then verify both preview and edit modes in
   Universal Editor before publication. Verify real submission only in an
   authorized test environment; local theme tests mock the submission endpoint.

The offline Playwright fixture in `test/e2e/theme/fixtures/alstom.html` demonstrates
this composition using an original placeholder illustration, not official assets.
Run `npm run test:e2e -- --config=test/e2e/theme/playwright.config.js` to check
desktop/mobile layouts, keyboard navigation, instrumentation, worker validation,
and mocked submission without an AEM login.

## Section 1: Rendering Pipeline

**One-line flow:**
`decorate()` → `createForm()` → `generateFormRendition()` → `renderField()` → `inputDecorator()` → `componentDecorator()`

The decorate function initializes the form, createForm orchestrates form creation, generateFormRendition walks the form definition, renderField creates DOM elements, inputDecorator applies attributes, and componentDecorator lazy-loads custom components.

## Section 2: generateFormRendition

**Step-by-step execution:**

1. Walks the items array from the form definition
2. Captcha fields get placeholder element with "CAPTCHA" text
3. renderField creates the DOM element for each field
4. appliedCssClassNames are added to the element
5. colSpanDecorator applies column span classes
6. Panel fields recurse into generateFormRendition
7. componentDecorator lazy-loads custom component scripts
8. Returns Promise — all field rendering happens in parallel via Promise.all
9. Appends all rendered children to container
10. Decorates panel container and applies componentDecorator to container itself

## Section 3: renderField

**Rendering logic:**

1. Strips `-input` suffix from fieldType
2. Looks up renderer in fieldRenderers registry
3. If renderer found, calls it to create field
4. Falls through to createFieldWrapper + createInput for unlisted types
5. Appends help text if description exists
6. Calls inputDecorator for non-group non-captcha fields
7. Returns the field wrapper element

Unlisted types (text-input, number-input, email, date-input, telephone-input) use default createInput() from util.js.

## Section 4: fieldRenderers Registry

All 11 registered field renderers:

| Key | Renderer | Creates |
|-----|----------|---------|
| drop-down | createSelect | `<select>` element |
| plain-text | createPlainText | `<p>` element |
| checkbox | createRadioOrCheckbox | Single checkbox input |
| button | createButton | `<button>` element |
| multiline | createTextArea | `<textarea>` element |
| panel | createFieldSet | `<fieldset>` with optional legend |
| radio | createRadioOrCheckbox | Single radio input |
| radio-group | createRadioOrCheckboxGroup | Fieldset with multiple radios |
| checkbox-group | createRadioOrCheckboxGroup | Fieldset with multiple checkboxes |
| image | createImage | `<picture>` element |
| heading | createHeading | `<h2>` element |

**Note:** Unlisted types (text-input, number-input, email, date-input, telephone-input) use default createInput() from util.js.

## Section 5: inputDecorator

**Key behaviors:**

1. **Basic attributes:** id, name, tooltip
2. **State attributes:** readOnly, autocomplete, disabled
3. **Display format handling** for number/date/text/email:
   - Sets `edit-value` and `display-value` attributes
   - Switches input type on focus/blur
   - Handles mobile touch events for native pickers
4. **Value by type:**
   - File inputs: multiple attribute
   - Checkbox/radio: checked state and value from enum
   - Other inputs: direct value assignment
5. **Validation attributes:**
   - Required attribute
   - aria-describedby for description
   - Email pattern validation
6. **File constraints:** minItems, maxItems, maxFileSize
7. **Constraint messages:** setConstraintsMessage stores custom error messages

## Section 6: Component Decorator System

**mappings.js overview:**

- **OOTBComponentDecorators**: accordion, file, modal, password, rating, repeat, tnc, toggleable-link, wizard
- **customComponents** (default: ['range'])
- **loadComponent**:
  - Status tracking via dataset.componentStatus (loading/loaded)
  - CSS load from components directory
  - Dynamic JS import with mod.default() call
  - Error handling for failed component loads
- **componentDecorator**:
  - Dispatch logic:
    - file-input → file component
    - :type ends with 'wizard' → wizard component
    - :type in OOTB or custom list → that component

## Section 7: Subscription System

**subscribe(fieldDiv, formId, callback)**

Allows custom components to access the form model when initialized.

**Code example for custom components:**
```javascript
import { subscribe } from '../../rules/index.js';

export default async function(element, fd, container, formId) {
  subscribe(element, formId, (fieldDiv, fieldModel, event) => {
    // Access fieldModel here
    // Listen to model changes
  });
}
```

**Timing:**
- If formModels[formId] exists, callback fires immediately
- Otherwise stored in formSubscriptions, fired when loadRuleEngine() completes

## Section 8: View Updates — fieldChanged

**Property handler table:**

| Property | Behavior |
|----------|----------|
| value | Updates input value, handles display format, checkboxes, radios, plain-text, images |
| visible | Sets data-visible attribute, closes modal dialogs if needed |
| enabled | Toggles disabled attribute based on field type |
| readOnly | Disables input or adds aria-readonly |
| label | Updates or creates label element |
| description | Updates or creates help text element |
| enum/enumNames | Recreates radio/checkbox/dropdown options |
| items | Adds or removes repeatable panel instances |
| valid | Clears custom validity and error messages |
| validationMessage | Sets custom validity for expression/constraint mismatches |
| required | Sets or removes data-required attribute |
| activeChild | Focuses and scrolls to active field |

**Note:** Render promises for repeatable panels tracked via renderPromises, awaited to ensure DOM exists before updates.

## Section 9: Adding a New Component

**5-step checklist:**

1. **Create directory and files:**
   - `/blocks/form/components/{component-name}/{component-name}.js`
   - `/blocks/form/components/{component-name}/{component-name}.css`

2. **Export default async function:**
   ```javascript
   export default async function(element, fd, container, formId) {
     // Component logic here
   }
   ```

3. **Register in mappings.js:**
   - Add to OOTBComponentDecorators array for built-in components
   - Or add to customComponents array for custom components

4. **Use subscribe() if model access needed:**
   ```javascript
   import { subscribe } from '../../rules/index.js';

   subscribe(element, formId, (fieldDiv, fieldModel, event) => {
     // Access and listen to fieldModel
   });
   ```

5. **Element is .field-wrapper div:**
   - Contains the field's DOM structure
   - Has dataset.id matching the field ID
   - Access fd parameter for field definition
