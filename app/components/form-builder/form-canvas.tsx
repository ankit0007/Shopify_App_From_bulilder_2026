import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  BuilderField,
  FormBuilderConfig,
  FormStyleTokens,
} from "../../domain/forms/builder-schema";
import { FIELD_REGISTRY } from "../../domain/forms/field-registry";

function fieldGridSpan(field: BuilderField, columns: number) {
  return Math.max(
    1,
    Math.min(columns, Math.round((field.width / 12) * columns)),
  );
}

function FieldPreview({
  field,
  style,
}: {
  field: BuilderField;
  style: FormStyleTokens;
}) {
  const commonClass =
    "mt-2 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm";
  const inputStyle = {
    backgroundColor: style.inputBackground,
    borderColor: style.borderColor,
    borderWidth: `${style.borderWidth}px`,
    color: style.textColor,
  };

  if (field.type === "textarea") {
    return (
      <textarea
        style={inputStyle}
        className={`${commonClass} min-h-20`}
        placeholder={field.placeholder}
        readOnly
      />
    );
  }
  if (field.type === "select" || field.type === "multiselect") {
    return (
      <select
        style={inputStyle}
        className={commonClass}
        multiple={field.type === "multiselect"}
        defaultValue={field.defaultValue}
      >
        {!field.defaultValue && <option value="">Select an option</option>}
        {field.options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (
    field.type === "radio" ||
    field.type === "checkbox" ||
    field.type === "yes_no"
  ) {
    const options =
      field.type === "yes_no"
        ? [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]
        : field.options;
    return (
      <div className="mt-2 space-y-2">
        {options.map((option) => (
          <label
            className="flex items-center gap-2 text-sm text-slate-600"
            key={option.value}
          >
            <input
              type={
                field.type === "radio" || field.type === "yes_no"
                  ? "radio"
                  : "checkbox"
              }
              readOnly
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "hidden") {
    return (
      <p className="mt-2 text-xs italic text-slate-400">
        Hidden value: {field.defaultValue || "Not set"}
      </p>
    );
  }
  return (
    <input
      style={inputStyle}
      className={commonClass}
      type={field.type === "datetime" ? "datetime-local" : field.type}
      placeholder={field.placeholder}
      defaultValue={field.defaultValue}
      readOnly
    />
  );
}

function SortableField({
  field,
  columns,
  style,
  selected,
  onSelect,
  onDelete,
}: {
  field: BuilderField;
  columns: number;
  style: FormStyleTokens;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
  });
  const animatedStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${fieldGridSpan(field, columns)} / span ${fieldGridSpan(field, columns)}`,
  };

  return (
    <article
      ref={setNodeRef}
      style={animatedStyle}
      className={`group relative rounded-xl border bg-white p-4 text-left shadow-sm transition ${
        selected
          ? "border-blue-500 ring-2 ring-blue-100"
          : "border-slate-200 hover:border-slate-300"
      } ${isDragging ? "z-10 opacity-70 shadow-xl" : ""}`}
      {...attributes}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-0.5 cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Reorder ${field.label}`}
          {...listeners}
        >
          <span aria-hidden>⋮⋮</span>
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onSelect}
            className="block text-left text-sm font-semibold text-slate-800 hover:text-blue-700"
          >
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </button>
          {field.description && (
            <p className="mt-1 text-xs text-slate-400">{field.description}</p>
          )}
          <FieldPreview field={field} style={style} />
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label={`Delete ${field.label}`}
        >
          ×
        </button>
      </div>
    </article>
  );
}

export function FormCanvas({
  config,
  selectedFieldId,
  onSelectField,
  onDeleteField,
}: {
  config: FormBuilderConfig;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteField: (id: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "form-canvas" });
  const sortedFields = [...config.fields].sort(
    (a, b) => a.row - b.row || a.column - b.column,
  );

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[560px] bg-slate-100/70 p-4 transition sm:p-6 ${
        isOver ? "bg-blue-50/80" : ""
      }`}
      aria-label="Form canvas"
    >
      <div
        className="mx-auto max-w-3xl rounded-2xl border p-5 shadow-sm sm:p-8"
        style={{
          backgroundColor: config.style.background,
          borderColor: config.style.borderColor,
          borderWidth: `${config.style.borderWidth}px`,
          color: config.style.textColor,
          fontFamily: config.style.fontFamily,
        }}
      >
        <div className="mb-8 border-b border-slate-100 pb-5">
          <p className="text-xl font-semibold text-slate-900">
            {config.settings.description || "Untitled form"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Configure the fields your customers will complete.
          </p>
        </div>
        <div
          className="grid items-start gap-4"
          style={{
            gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
          }}
        >
          <SortableContext
            items={sortedFields.map((field) => field.id)}
            strategy={rectSortingStrategy}
          >
            {sortedFields.map((field) => (
              <SortableField
                key={field.id}
                field={field}
                columns={config.columns}
                style={config.style}
                selected={field.id === selectedFieldId}
                onSelect={() => onSelectField(field.id)}
                onDelete={() => onDeleteField(field.id)}
              />
            ))}
          </SortableContext>
          {!sortedFields.length && (
            <div className="col-span-full flex min-h-64 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
              <div>
                <p className="font-medium text-slate-700">
                  Start building your form
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Drag a field from the library into this canvas.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="mt-8 border-t border-slate-100 pt-5">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            style={{
              backgroundColor: config.style.buttonBackground,
              color: config.style.buttonTextColor,
            }}
          >
            {config.settings.submitLabel || "Submit"}
          </button>
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-slate-400">
        {FIELD_REGISTRY[sortedFields[0]?.type ?? "text"].label} fields share the
        same future storefront schema.
      </p>
    </section>
  );
}
