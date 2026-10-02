import type {
  BuilderField,
  FormBuilderConfig,
} from "../../domain/forms/builder-schema";
import {
  autoFieldWidth,
  fieldGridSpan,
} from "../../domain/forms/builder-schema";

export type DropPosition = "before" | "after";

export type CanvasCellTarget = {
  row: number;
  column: number;
};

function canPlace(
  occupied: Set<string>,
  row: number,
  column: number,
  span: number,
  columns: number,
) {
  if (column < 1 || column + span - 1 > columns) return false;
  for (let offset = 0; offset < span; offset += 1) {
    if (occupied.has(`${row}:${column + offset}`)) return false;
  }
  return true;
}

function occupy(
  occupied: Set<string>,
  row: number,
  column: number,
  span: number,
) {
  for (let offset = 0; offset < span; offset += 1) {
    occupied.add(`${row}:${column + offset}`);
  }
}

function findOpenPosition(
  occupied: Set<string>,
  preferredRow: number,
  preferredColumn: number,
  span: number,
  columns: number,
) {
  for (
    let row = Math.max(1, preferredRow);
    row < preferredRow + 1000;
    row += 1
  ) {
    const candidates = [
      preferredColumn,
      ...Array.from({ length: columns }, (_, index) => index + 1),
    ];
    for (const column of candidates) {
      if (canPlace(occupied, row, column, span, columns)) {
        return { row, column };
      }
    }
  }
  return { row: preferredRow, column: 1 };
}

export function normalizeBuilderFields(
  fields: BuilderField[],
  columns: FormBuilderConfig["columns"],
) {
  const occupied = new Set<string>();
  return sortBuilderFields(fields).map((field) => {
    const normalized = {
      ...field,
      width:
        field.widthMode === "manual" ? field.width : autoFieldWidth(columns),
    };
    const span = fieldGridSpan(normalized, columns);
    const position = findOpenPosition(
      occupied,
      normalized.row,
      Math.min(columns, normalized.column),
      span,
      columns,
    );
    occupy(occupied, position.row, position.column, span);
    return { ...normalized, ...position };
  });
}

export function normalizeBuilderConfigForColumns(
  config: FormBuilderConfig,
  columns: FormBuilderConfig["columns"],
): FormBuilderConfig {
  return {
    ...config,
    columns,
    fields: normalizeBuilderFields(
      config.fields.map((field) => ({
        ...field,
        column: Math.min(columns, field.column),
      })),
      columns,
    ),
  };
}

export function sortBuilderFields(fields: BuilderField[]) {
  return fields
    .map((field, index) => ({ field, index }))
    .sort(
      (left, right) =>
        left.field.row - right.field.row ||
        left.field.column - right.field.column ||
        left.index - right.index,
    )
    .map(({ field }) => field);
}

export function parseCanvasCellTarget(id: string): CanvasCellTarget | null {
  const match = /^canvas-cell:(\d+):(\d+)$/.exec(id);
  if (!match) return null;
  return {
    row: Math.max(1, Number(match[1])),
    column: Math.max(1, Number(match[2])),
  };
}

export function moveBuilderField(
  config: FormBuilderConfig,
  activeId: string,
  overId: string,
  position: DropPosition,
): FormBuilderConfig | null {
  if (activeId === overId) return config;
  const active = config.fields.find((field) => field.id === activeId);
  if (!active) return null;

  const ordered = sortBuilderFields(config.fields);
  const targetIndex = ordered.findIndex((field) => field.id === overId);
  const target = ordered[targetIndex];
  const cell = parseCanvasCellTarget(overId);

  if (!target && !cell) return null;

  const row = cell?.row ?? target?.row ?? active.row;
  const targetColumn = cell?.column ?? target?.column ?? active.column;
  const column =
    cell || position === "before"
      ? Math.min(config.columns, targetColumn)
      : Math.min(config.columns, targetColumn + 1);
  const moved = {
    ...active,
    row,
    column,
    width: autoFieldWidth(config.columns),
    widthMode: "auto" as const,
  };
  const withoutActive = ordered.filter((field) => field.id !== activeId);

  if (cell) {
    const insertionIndex = Math.min(
      withoutActive.length,
      withoutActive.findIndex(
        (field) =>
          field.row > row || (field.row === row && field.column > column),
      ),
    );
    const safeIndex =
      insertionIndex < 0 ? withoutActive.length : insertionIndex;
    withoutActive.splice(safeIndex, 0, moved);
  } else {
    const targetPosition = withoutActive.findIndex(
      (field) => field.id === overId,
    );
    const safeIndex = Math.max(
      0,
      targetPosition + (position === "after" ? 1 : 0),
    );
    withoutActive.splice(safeIndex, 0, moved);
  }

  return {
    ...config,
    fields: normalizeBuilderFields(withoutActive, config.columns),
  };
}

export function nextLibraryFieldPlacement(
  config: FormBuilderConfig,
  overId: string | null,
): CanvasCellTarget {
  const cell = overId ? parseCanvasCellTarget(overId) : null;
  if (cell) {
    return {
      row: cell.row,
      column: Math.min(config.columns, cell.column),
    };
  }

  const target = overId
    ? config.fields.find((field) => field.id === overId)
    : null;
  if (target) return { row: target.row, column: target.column };

  const lastRow = config.fields.reduce(
    (maxRow, field) => Math.max(maxRow, field.row),
    0,
  );
  return { row: lastRow + 1, column: 1 };
}

export function placeLibraryField(
  config: FormBuilderConfig,
  field: BuilderField,
  overId: string | null,
  position: DropPosition,
) {
  const placement = nextLibraryFieldPlacement(config, overId);
  const target = overId
    ? config.fields.find((candidate) => candidate.id === overId)
    : null;
  const ordered = sortBuilderFields(config.fields);
  const nextFields = [...ordered];
  const placed = {
    ...field,
    row: placement.row,
    column: placement.column,
    width: autoFieldWidth(config.columns),
    widthMode: "auto" as const,
  };

  if (target) {
    const targetIndex = nextFields.findIndex(
      (candidate) => candidate.id === target.id,
    );
    nextFields.splice(
      Math.max(0, targetIndex + (position === "after" ? 1 : 0)),
      0,
      placed,
    );
  } else {
    nextFields.push(placed);
  }

  return {
    ...config,
    fields: normalizeBuilderFields(nextFields, config.columns),
  };
}
