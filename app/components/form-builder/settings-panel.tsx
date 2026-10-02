import type {
  BuilderField,
  FormBuilderConfig,
  FormStyleTokens,
} from "../../domain/forms/builder-schema";
import { autoFieldWidth } from "../../domain/forms/builder-schema";
import { FIELD_REGISTRY } from "../../domain/forms/field-registry";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function FieldSetting({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint && (
        <span className="mt-1 block text-xs font-normal text-slate-400">
          {hint}
        </span>
      )}
    </label>
  );
}

export function FieldSettingsPanel({
  field,
  columns,
  onChange,
}: {
  field: BuilderField | null;
  columns: number;
  onChange: (patch: Partial<BuilderField>) => void;
}) {
  if (!field) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center p-6 text-center">
        <div>
          <p className="font-medium text-slate-700">Select a field</p>
          <p className="mt-1 text-sm text-slate-500">
            Field settings will appear here.
          </p>
        </div>
      </div>
    );
  }

  const definition = FIELD_REGISTRY[field.type];
  const updateValidation = (patch: Partial<BuilderField["validation"]>) =>
    onChange({ validation: { ...field.validation, ...patch } });
  const updateOption = (
    index: number,
    patch: Partial<BuilderField["options"][number]>,
  ) =>
    onChange({
      options: field.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    });

  return (
    <div className="space-y-5 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Field settings
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          {definition.label}
        </h2>
      </div>
      <div className="space-y-4">
        <FieldSetting label="Label">
          <input
            className={inputClass}
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </FieldSetting>
        <FieldSetting
          label="Field name"
          hint="Stable identifier used by future submissions."
        >
          <input
            className={inputClass}
            value={field.name}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </FieldSetting>
        <FieldSetting label="Description">
          <textarea
            className={`${inputClass} min-h-16`}
            value={field.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </FieldSetting>
        {definition.supportsPlaceholder && (
          <FieldSetting label="Placeholder">
            <input
              className={inputClass}
              value={field.placeholder}
              onChange={(event) =>
                onChange({ placeholder: event.target.value })
              }
            />
          </FieldSetting>
        )}
        {definition.supportsDefaultValue && (
          <FieldSetting label="Default value">
            <input
              className={inputClass}
              value={field.defaultValue}
              onChange={(event) =>
                onChange({ defaultValue: event.target.value })
              }
            />
          </FieldSetting>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FieldSetting label="Column">
            <select
              className={inputClass}
              value={field.column}
              onChange={(event) =>
                onChange({ column: Number(event.target.value) })
              }
            >
              {Array.from({ length: columns }, (_, index) => index + 1).map(
                (column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ),
              )}
            </select>
          </FieldSetting>
          <FieldSetting label="Width">
            <select
              className={inputClass}
              value={
                field.widthMode === "manual" ? String(field.width) : "auto"
              }
              onChange={(event) =>
                event.target.value === "auto"
                  ? onChange({
                      width: autoFieldWidth(columns as 1 | 2 | 3),
                      widthMode: "auto",
                    })
                  : onChange({
                      width: Number(
                        event.target.value,
                      ) as BuilderField["width"],
                      widthMode: "manual",
                    })
              }
            >
              <option value="auto">
                Auto (
                {Math.round((autoFieldWidth(columns as 1 | 2 | 3) / 12) * 100)}
                %)
              </option>
              {[3, 4, 6, 8, 9, 12].map((width) => (
                <option key={width} value={width}>
                  {Math.round((width / 12) * 100)}%
                </option>
              ))}
            </select>
          </FieldSetting>
        </div>
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Behavior
          </p>
          {[
            ["required", "Required"],
            ["disabled", "Disabled"],
            ["hidden", "Hidden"],
          ].map(([key, label]) => (
            <label
              className="flex items-center justify-between text-sm text-slate-700"
              key={key}
            >
              {label}
              <input
                type="checkbox"
                checked={Boolean(
                  field[key as "required" | "disabled" | "hidden"],
                )}
                onChange={(event) => onChange({ [key]: event.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </label>
          ))}
        </div>
        {definition.supportsOptions && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Options</p>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                onClick={() =>
                  onChange({
                    options: [
                      ...field.options,
                      {
                        label: "New option",
                        value: `option_${field.options.length + 1}`,
                      },
                    ],
                  })
                }
              >
                Add option
              </button>
            </div>
            {field.options.map((option, index) => (
              <div className="flex gap-2" key={`${option.value}-${index}`}>
                <input
                  className={inputClass}
                  value={option.label}
                  onChange={(event) =>
                    updateOption(index, { label: event.target.value })
                  }
                  aria-label={`Option ${index + 1} label`}
                />
                <button
                  type="button"
                  className="rounded-lg px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  onClick={() =>
                    onChange({
                      options: field.options.filter(
                        (_, optionIndex) => optionIndex !== index,
                      ),
                    })
                  }
                  aria-label={`Remove option ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Validation</p>
          {(field.type === "text" ||
            field.type === "textarea" ||
            field.type === "password") && (
            <div className="grid grid-cols-2 gap-3">
              <FieldSetting label="Min length">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={field.validation.minLength ?? ""}
                  onChange={(event) =>
                    updateValidation({
                      minLength: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    })
                  }
                />
              </FieldSetting>
              <FieldSetting label="Max length">
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={field.validation.maxLength ?? ""}
                  onChange={(event) =>
                    updateValidation({
                      maxLength: event.target.value
                        ? Number(event.target.value)
                        : undefined,
                    })
                  }
                />
              </FieldSetting>
            </div>
          )}
          {definition.supportsPattern && (
            <FieldSetting label="Pattern">
              <input
                className={inputClass}
                value={field.validation.pattern ?? ""}
                onChange={(event) =>
                  updateValidation({ pattern: event.target.value || undefined })
                }
                placeholder="Optional regex"
              />
            </FieldSetting>
          )}
          <FieldSetting label="Required message">
            <input
              className={inputClass}
              value={field.validation.requiredMessage ?? ""}
              onChange={(event) =>
                updateValidation({ requiredMessage: event.target.value })
              }
            />
          </FieldSetting>
          <FieldSetting label="Invalid value message">
            <input
              className={inputClass}
              value={field.validation.invalidMessage ?? ""}
              onChange={(event) =>
                updateValidation({ invalidMessage: event.target.value })
              }
            />
          </FieldSetting>
        </div>
      </div>
    </div>
  );
}

export function FormSettingsPanel({
  config,
  onChange,
}: {
  config: FormBuilderConfig;
  onChange: (patch: Partial<FormBuilderConfig["settings"]>) => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Form settings
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Submission experience
        </h2>
      </div>
      <FieldSetting label="Internal description">
        <textarea
          className={`${inputClass} min-h-20`}
          value={config.settings.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </FieldSetting>
      <FieldSetting label="Submit button text">
        <input
          className={inputClass}
          value={config.settings.submitLabel}
          onChange={(event) => onChange({ submitLabel: event.target.value })}
        />
      </FieldSetting>
      <FieldSetting label="Success message">
        <textarea
          className={`${inputClass} min-h-16`}
          value={config.settings.successMessage}
          onChange={(event) => onChange({ successMessage: event.target.value })}
        />
      </FieldSetting>
      <FieldSetting label="Error message">
        <textarea
          className={`${inputClass} min-h-16`}
          value={config.settings.errorMessage}
          onChange={(event) => onChange({ errorMessage: event.target.value })}
        />
      </FieldSetting>
    </div>
  );
}

export function StyleSettingsPanel({
  style,
  onChange,
}: {
  style: FormStyleTokens;
  onChange: (patch: Partial<FormStyleTokens>) => void;
}) {
  return (
    <div className="space-y-5 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Appearance
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Style tokens
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ["textColor", "Text color"],
          ["background", "Form background"],
          ["inputBackground", "Input background"],
          ["borderColor", "Border color"],
          ["buttonTextColor", "Button text"],
          ["buttonBackground", "Button background"],
        ].map(([key, label]) => (
          <label className="text-sm font-medium text-slate-700" key={key}>
            {label}
            <input
              className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white p-1"
              type="color"
              value={style[key as keyof FormStyleTokens] as string}
              onChange={(event) => onChange({ [key]: event.target.value })}
            />
          </label>
        ))}
      </div>
      <FieldSetting label="Form width">
        <select
          className={inputClass}
          value={style.formWidth}
          onChange={(event) =>
            onChange({
              formWidth: event.target.value as FormStyleTokens["formWidth"],
            })
          }
        >
          <option value="sm">Compact</option>
          <option value="md">Standard</option>
          <option value="lg">Wide</option>
          <option value="full">Full width</option>
        </select>
      </FieldSetting>
      <FieldSetting label="Font family">
        <select
          className={inputClass}
          value={style.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
        >
          <option value="Inter">Inter</option>
          <option value="system-ui">System UI</option>
          <option value="Georgia">Georgia</option>
        </select>
      </FieldSetting>
      <div className="grid grid-cols-2 gap-3">
        <FieldSetting label="Font size">
          <select
            className={inputClass}
            value={style.fontSize}
            onChange={(event) =>
              onChange({
                fontSize: event.target.value as FormStyleTokens["fontSize"],
              })
            }
          >
            <option value="sm">Small</option>
            <option value="base">Medium</option>
            <option value="lg">Large</option>
          </select>
        </FieldSetting>
        <FieldSetting label="Label size">
          <select
            className={inputClass}
            value={style.labelSize}
            onChange={(event) =>
              onChange({
                labelSize: event.target.value as FormStyleTokens["labelSize"],
              })
            }
          >
            <option value="sm">Small</option>
            <option value="base">Medium</option>
            <option value="lg">Large</option>
          </select>
        </FieldSetting>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldSetting label="Border width">
          <select
            className={inputClass}
            value={style.borderWidth}
            onChange={(event) =>
              onChange({
                borderWidth: Number(
                  event.target.value,
                ) as FormStyleTokens["borderWidth"],
              })
            }
          >
            <option value="0">None</option>
            <option value="1">One pixel</option>
            <option value="2">Two pixels</option>
          </select>
        </FieldSetting>
        <FieldSetting label="Button radius">
          <select
            className={inputClass}
            value={style.buttonRadius}
            onChange={(event) =>
              onChange({
                buttonRadius: event.target
                  .value as FormStyleTokens["buttonRadius"],
              })
            }
          >
            <option value="none">Square</option>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </FieldSetting>
      </div>
      <FieldSetting label="Field spacing">
        <select
          className={inputClass}
          value={style.fieldSpacing}
          onChange={(event) =>
            onChange({
              fieldSpacing: event.target
                .value as FormStyleTokens["fieldSpacing"],
            })
          }
        >
          <option value="compact">Compact</option>
          <option value="comfortable">Comfortable</option>
          <option value="spacious">Spacious</option>
        </select>
      </FieldSetting>
      <FieldSetting label="Border radius">
        <select
          className={inputClass}
          value={style.borderRadius}
          onChange={(event) =>
            onChange({
              borderRadius: event.target
                .value as FormStyleTokens["borderRadius"],
            })
          }
        >
          <option value="none">Square</option>
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </FieldSetting>
    </div>
  );
}
