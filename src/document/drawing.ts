import { SectionProperties } from "./section";

export type AnchorHostPart = "header" | "footer" | null;

interface AnchorMargins {
	left?: string;
	right?: string;
	top?: string;
	bottom?: string;
}

interface DrawingSize {
	width?: string;
	height?: string;
}

export interface DrawingLayoutOptions {
	drawing: any;
	section?: SectionProperties;
	size?: DrawingSize;
	hostPart: AnchorHostPart;
}

export interface DrawingLayoutResult {
	position: "relative" | "absolute";
	margin?: string;
	zIndex?: string;
	left?: string;
	top?: string;
	width?: string;
	height?: string;
}

export function resolveDrawingLayout(options: DrawingLayoutOptions): DrawingLayoutResult | null {
	const { drawing, section, size = {}, hostPart } = options;

	if (!drawing?.anchor)
		return null;

	if (drawing.wrapType && drawing.wrapType !== "none")
		return null;

	const margins = section?.pageMargins ?? {};
	const pageRelative = isPageRelativeAnchor(drawing);

	const left = resolveAxisOffset("horizontal", drawing, margins, size.width, hostPart);
	const top = resolveAxisOffset("vertical", drawing, margins, size.height, hostPart);

	const baseZ = drawing.behindDoc
		? "-1"
		: (hostPart === "header" || hostPart === "footer") ? "0" : "10";

	return {
		position: pageRelative ? "absolute" : "relative",
		margin: "0",
		zIndex: baseZ,
		left: left ?? undefined,
		top: top ?? undefined
	};
}

export function isPageRelativeAnchor(drawing: any): boolean {
	if (drawing?.simplePos)
		return true;

	const pageRefs = new Set([
		"page",
		"margin",
		"leftMargin",
		"rightMargin",
		"insideMargin",
		"outsideMargin"
	]);

	const horizontalRef = drawing?.positionH?.relative;
	const verticalRef = drawing?.positionV?.relative;

	return pageRefs.has(horizontalRef) || pageRefs.has(verticalRef);
}

function resolveAxisOffset(
	axis: "horizontal" | "vertical",
	drawing: any,
	margins: AnchorMargins,
	size: string,
	hostPart: AnchorHostPart
): string | null {
	const simpleCoord = axis === "horizontal" ? drawing.simplePosX : drawing.simplePosY;

	if (drawing.simplePos && simpleCoord)
		return simpleCoord;

	const pos = axis === "horizontal" ? drawing.positionH : drawing.positionV;

	if (!pos)
		return null;

	if (pos.offset)
		return pos.offset;

	const align = pos.align;

	if (!align)
		return null;

	const relative = pos.relative ?? "page";

	switch (relative) {
		case "page":
			return alignToPage(align, size);
		case "margin":
		case "leftMargin":
		case "rightMargin":
		case "insideMargin":
		case "outsideMargin":
			return alignToMargins(axis, align, size, margins, hostPart);
		default:
			return alignWithinContainer(align, size);
	}
}

function alignToPage(align: string, size?: string): string {
	switch (align) {
		case "left":
		case "top":
			return "0px";
		case "right":
		case "bottom":
			return size ? `calc(100% - ${size})` : "100%";
		case "center":
			return size ? `calc(50% - (${size} / 2))` : "50%";
		default:
			return "0px";
	}
}

function alignToMargins(
	axis: "horizontal" | "vertical",
	align: string,
	size: string,
	margins: AnchorMargins,
	hostPart: AnchorHostPart
): string {
	const startMargin = ensureLength(axis === "horizontal" ? margins.left : margins.top);
	const endMargin = ensureLength(axis === "horizontal" ? margins.right : margins.bottom);

	// Headers/footers already include margin compensation
	const applyMargins = !hostPart;
	const start = applyMargins ? startMargin : "0px";
	const end = applyMargins ? endMargin : "0px";

	switch (align) {
		case "left":
		case "top":
			return start;
		case "right":
		case "bottom":
			if (size)
				return `calc(100% - ${end} - ${size})`;
			return `calc(100% - ${end})`;
		case "center":
			if (size)
				return applyMargins && (start !== "0px" || end !== "0px")
					? `calc(50% - (${size} / 2))`
					: `calc(50% - (${size} / 2))`;
			return "50%";
		default:
			return start;
	}
}

function alignWithinContainer(align: string, size?: string): string {
	switch (align) {
		case "right":
		case "bottom":
			return size ? `calc(100% - ${size})` : "100%";
		case "center":
			return size ? `calc(50% - (${size} / 2))` : "50%";
		default:
			return "0px";
	}
}

function ensureLength(value?: string): string {
	return value ?? "0px";
}
