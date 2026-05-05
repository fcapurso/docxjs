import { DocumentParser } from '../document-parser';
import { convertLength, LengthUsage } from '../document/common';
import { OpenXmlElementBase, DomType } from '../document/dom';
import xml from '../parser/xml-parser';
import { formatCssRules, parseCssRules } from '../utils';

export interface VmlPresentationStyle {
	justifyContent?: "flex-start" | "center" | "flex-end";
	contentHostStyle?: Record<string, string>;
}

export class VmlElement extends OpenXmlElementBase {
	type: DomType = DomType.VmlElement;
	tagName: string;
	cssStyleText?: string;
	attrs: Record<string, string> = {};
	wrapType?: string;
	imageHref?: {
		id: string,
		title: string
	}
	presentationStyle?: VmlPresentationStyle;
}

export function parseVmlElement(elem: Element, parser: DocumentParser): VmlElement {
	var result = new VmlElement();

	switch (elem.localName) {
		case "rect":
			result.tagName = "rect"; 
			Object.assign(result.attrs, { width: '100%', height: '100%' });
			break;

		case "oval":
			result.tagName = "ellipse"; 
			Object.assign(result.attrs, { cx: "50%", cy: "50%", rx: "50%", ry: "50%" });
			break;
	
		case "line":
			result.tagName = "line"; 
			break;

		case "shape":
			result.tagName = "g"; 
			break;

		case "textbox":
			result.tagName = "foreignObject"; 
			Object.assign(result.attrs, { width: '100%', height: '100%' });
			break;
	
		default:
			return null;
	}

	for (const at of xml.attrs(elem)) {
		switch (at.localName) {
			case "style":
				const style = parseStyle(at.value);
				result.cssStyleText = style.cssStyleText;
				result.presentationStyle = style.presentationStyle;
				break;

			case "fillcolor": 
				result.attrs.fill = at.value; 
				break;

			case "from":
				const [x1, y1] = parsePoint(at.value);
				Object.assign(result.attrs, { x1, y1 });
				break;

			case "to":
				const [x2, y2] = parsePoint(at.value);
				Object.assign(result.attrs, { x2, y2 });
				break;
		}
	}

	for (const el of xml.elements(elem)) {
		switch (el.localName) {
			case "stroke": 
				Object.assign(result.attrs, parseStroke(el));
				break;

			case "fill": 
				Object.assign(result.attrs, parseFill(el));
				break;

			case "imagedata":
				result.tagName = "image";
				Object.assign(result.attrs, { width: '100%', height: '100%' });
				result.imageHref = {
					id: xml.attr(el, "id"),
					title: xml.attr(el, "title"),
				}
				break;

			case "txbxContent": 
				result.children.push(...parser.parseBodyElements(el));
				break;

			default:
				const child = parseVmlElement(el, parser);
				child && result.children.push(child);
				break;
		}
	}

	return result;
}

function parseStroke(el: Element): Record<string, string> {
	return {
		'stroke': xml.attr(el, "color"),
		'stroke-width': xml.lengthAttr(el, "weight", LengthUsage.Emu) ?? '1px'
	};
}

function parseFill(el: Element): Record<string, string> {
	return {
		//'fill': xml.attr(el, "color2")
	};
}

function parsePoint(val: string): string[] {
	return val.split(",");
}

function parseStyle(cssStyleText: string): { cssStyleText?: string, presentationStyle?: VmlPresentationStyle } {
	const parsedStyle = parseCssRules(cssStyleText);
	const presentationStyle: VmlPresentationStyle = {};

	for (const [key, value] of Object.entries(parsedStyle)) {
		const normalizedKey = key.trim().toLowerCase();
		switch (normalizedKey) {
			case "v-text-anchor":
				switch (value.trim().toLowerCase()) {
					case "bottom":
					case "bottom-center":
					case "bottom-baseline":
						presentationStyle.justifyContent = "flex-end";
						break;
					case "middle":
					case "center":
					case "middle-center":
					case "center-center":
						presentationStyle.justifyContent = "center";
						break;
					default:
						presentationStyle.justifyContent = "flex-start";
						break;
				}
				presentationStyle.contentHostStyle = {
					boxSizing: "border-box",
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: presentationStyle.justifyContent
				};
				delete parsedStyle[key];
				break;
		}
	}

	const svgStyleText = formatCssRules(parsedStyle);
	return {
		cssStyleText: svgStyleText || undefined,
		presentationStyle: Object.keys(presentationStyle).length ? presentationStyle : undefined
	};
}

function convertPath(path: string): string {
	return path.replace(/([mlxe])|([-\d]+)|([,])/g, (m) => {
		if (/[-\d]/.test(m)) return convertLength(m,  LengthUsage.VmlEmu);
		if (/[ml,]/.test(m)) return m;

		return '';
	});
}