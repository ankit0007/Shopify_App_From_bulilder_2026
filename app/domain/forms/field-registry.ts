export type BuilderFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "url"
  | "password"
  | "date"
  | "time"
  | "datetime"
  | "select"
  | "multiselect"
  | "radio"
  | "checkbox"
  | "yes_no"
  | "hidden";

export type FieldOption = {
  label: string;
  value: string;
};

export type FieldDefinition = {
  type: BuilderFieldType;
  label: string;
  description: string;
  supportsOptions: boolean;
  supportsPlaceholder: boolean;
  supportsDefaultValue: boolean;
  supportsPattern: boolean;
  inputMode?: "text" | "email" | "tel" | "numeric" | "url";
};

export const FIELD_REGISTRY: Record<BuilderFieldType, FieldDefinition> = {
  text: {
    type: "text",
    label: "Text",
    description: "Short text response",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: true,
  },
  textarea: {
    type: "textarea",
    label: "Textarea",
    description: "Long text response",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: true,
  },
  email: {
    type: "email",
    label: "Email",
    description: "Email address",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: false,
    inputMode: "email",
  },
  phone: {
    type: "phone",
    label: "Phone",
    description: "Phone number",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: true,
    inputMode: "tel",
  },
  number: {
    type: "number",
    label: "Number",
    description: "Numeric response",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: false,
    inputMode: "numeric",
  },
  url: {
    type: "url",
    label: "URL",
    description: "Website address",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: false,
    inputMode: "url",
  },
  password: {
    type: "password",
    label: "Password",
    description: "Sensitive text",
    supportsOptions: false,
    supportsPlaceholder: true,
    supportsDefaultValue: false,
    supportsPattern: true,
  },
  date: {
    type: "date",
    label: "Date",
    description: "Calendar date",
    supportsOptions: false,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  time: {
    type: "time",
    label: "Time",
    description: "Time of day",
    supportsOptions: false,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  datetime: {
    type: "datetime",
    label: "Date & time",
    description: "Date and time",
    supportsOptions: false,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  select: {
    type: "select",
    label: "Select",
    description: "Choose one option",
    supportsOptions: true,
    supportsPlaceholder: true,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  multiselect: {
    type: "multiselect",
    label: "Multi-select",
    description: "Choose multiple options",
    supportsOptions: true,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  radio: {
    type: "radio",
    label: "Radio buttons",
    description: "Choose one visible option",
    supportsOptions: true,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  checkbox: {
    type: "checkbox",
    label: "Checkboxes",
    description: "Choose multiple visible options",
    supportsOptions: true,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  yes_no: {
    type: "yes_no",
    label: "Yes / No",
    description: "Binary choice",
    supportsOptions: false,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
  hidden: {
    type: "hidden",
    label: "Hidden",
    description: "Non-visible fixed value",
    supportsOptions: false,
    supportsPlaceholder: false,
    supportsDefaultValue: true,
    supportsPattern: false,
  },
};

export const FIELD_GROUPS = [
  {
    label: "Basic",
    types: ["text", "textarea", "email", "phone", "number", "url"] as BuilderFieldType[],
  },
  {
    label: "Date & time",
    types: ["date", "time", "datetime"] as BuilderFieldType[],
  },
  {
    label: "Choices",
    types: ["select", "multiselect", "radio", "checkbox", "yes_no"] as BuilderFieldType[],
  },
  {
    label: "Advanced",
    types: ["password", "hidden"] as BuilderFieldType[],
  },
];
