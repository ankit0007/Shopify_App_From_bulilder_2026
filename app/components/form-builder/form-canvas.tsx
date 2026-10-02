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
import { fieldGridSpan } from "../../domain/forms/builder-schema";
import { FIELD_REGISTRY } from "../../domain/forms/field-registry";
import { sortBuilderFields } from "./builder-dnd";

function fieldOccupiesCell(
  field: BuilderField,
  row: number,
  column: number,
  columns: number,
) {
  const span = fieldGridSpan(field, columns as FormBuilderConfig["columns"]);
  return (
    field.row === row && column >= field.column && column < field.column + span
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
  dropTarget,
}: {
  field: BuilderField;
  columns: number;
  style: FormStyleTokens;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  dropTarget: "before" | "after" | null;
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
    gridColumn: `${Math.max(1, Math.min(columns, field.column))} / span ${fieldGridSpan(field, columns as FormBuilderConfig["columns"])}`,
    gridRow: field.row,
    minWidth: 0,
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
      {dropTarget === "before" && (
        <div className="pointer-events-none absolute -top-2 left-0 right-0 z-20 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
          <span className="h-0.5 flex-1 bg-blue-500" />
          <span className="rounded bg-blue-50 px-1.5 py-0.5">Drop here</span>
          <span className="h-0.5 flex-1 bg-blue-500" />
        </div>
      )}
      {dropTarget === "after" && (
        <div className="pointer-events-none absolute -bottom-2 left-0 right-0 z-20 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
          <span className="h-0.5 flex-1 bg-blue-500" />
          <span className="rounded bg-blue-50 px-1.5 py-0.5">Drop here</span>
          <span className="h-0.5 flex-1 bg-blue-500" />
        </div>
      )}
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-0.5 touch-none cursor-grab rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 active:cursor-grabbing"
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
  activeId,
  overId,
  dropPosition,
}: {
  config: FormBuilderConfig;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDeleteField: (id: string) => void;
  activeId: string | null;
  overId: string | null;
  dropPosition: "before" | "after" | null;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "form-canvas",
    data: { type: "canvas" },
  });
  const sortedFields = sortBuilderFields(config.fields);
  const maxRow = Math.max(
    1,
    sortedFields.reduce((max, field) => Math.max(max, field.row), 0) + 1,
  );
  const dropRows = Array.from({ length: maxRow }, (_, index) => index + 1);

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
          className="relative grid min-h-64 items-start gap-4"
          style={{
            gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
          }}
        >
          {activeId &&
            dropRows.flatMap((row) =>
              Array.from(
                { length: config.columns },
                (_, index) => index + 1,
              ).map((column) => {
                const occupied = sortedFields.some((field) =>
                  fieldOccupiesCell(field, row, column, config.columns),
                );
                if (occupied) return null;
                return (
                  <CanvasDropZone
                    key={`canvas-cell:${row}:${column}`}
                    row={row}
                    column={column}
                    active={overId === `canvas-cell:${row}:${column}`}
                    visible={Boolean(activeId)}
                  />
                );
              }),
            )}
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
                dropTarget={
                  overId === field.id && activeId !== field.id
                    ? dropPosition
                    : null
                }
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

function CanvasDropZone({
  row,
  column,
  active,
  visible,
}: {
  row: number;
  column: number;
  active: boolean;
  visible: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `canvas-cell:${row}:${column}`,
    data: { type: "canvas-cell", row, column },
  });

  return (
    <div
      ref={setNodeRef}
      className={`z-0 flex min-h-24 items-center justify-center rounded-xl border-2 border-dashed p-3 text-center text-xs transition ${
        visible
          ? active
            ? "border-blue-400 bg-blue-50 text-blue-700"
            : "border-slate-200 text-slate-400"
          : "pointer-events-none opacity-0"
      }`}
      style={{ gridColumn: column, gridRow: row }}
    >
      Drop field here
    </div>
  );
}
