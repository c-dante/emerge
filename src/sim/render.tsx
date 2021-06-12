import fp from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity, ZoomTransform } from 'd3-zoom';
import { select as d3select } from 'd3-selection';
import { SimState, ThingType } from './things';
import { SizedElement } from './SizedElement';

// Some shared render constants
const PADDING = 1;
const SCALE = 10;
const HALF_SCALE = SCALE / 2;

const TypeToColor = {
	[ThingType.Cloud]: 'lightblue',
	[ThingType.RainCloud]: 'slategrey',
	[ThingType.Root]: 'brown',
	[ThingType.Seed]: 'orange',
	[ThingType.Water]: 'blue',
};


// ## Canvas Renderer
const renderToContext = (ctx: CanvasRenderingContext2D, xform: ZoomTransform, state: SimState, rect: DOMRect) => {
	ctx?.clearRect(0, 0, rect.width, rect.height);
	ctx?.save();
	ctx?.translate(xform.x, xform.y);
	ctx?.scale(xform.k, xform.k);
	for (const [[x, y], things] of state.things) {
		for (const thing of things) {
			ctx.fillStyle = TypeToColor[thing.type];
			ctx.fillRect(x * (SCALE + PADDING) - HALF_SCALE, y * (SCALE + PADDING) - HALF_SCALE, SCALE, SCALE);
		}
	}
	ctx.restore();
};


// ## SVG Renderer
const renderToSvg = (root: Element, state: SimState) => {
	return d3select(root)
		.selectAll('rect')
		.data([...state.things.values()].flat())
		// Everything is a rectangle I guess
		.join('rect')
			.attr('x', thing => thing.pos[0] * (SCALE + 1) - HALF_SCALE)
			.attr('y', thing => thing.pos[1] * (SCALE + 1) - HALF_SCALE)
			.attr('width', SCALE)
			.attr('height', SCALE)
			.attr('fill', thing => TypeToColor[thing.type]);
};



// ### Save zoom / render state
const RENDER_SAVE = 'RENDER_SAVE';
const debounceSaveZoom = fp.debounce((zoom) => {
	sessionStorage.setItem(RENDER_SAVE, JSON.stringify(zoom));
}, 250);
const loadSaveZoom = () => {
	const saved = sessionStorage.getItem(RENDER_SAVE);
	if (!saved) {
		return zoomIdentity;
	}

	try {
		const args = JSON.parse(saved);
		return zoomIdentity
			.translate(args.x, args.y)
			.scale(args.k);
	} catch {
		return zoomIdentity;
	}
};



// ## Control + Render types
export type RenderController = {
	center: () => void;
}
export type RenderProps = {
	state: SimState;
	onResize?: (rect: DOMRectReadOnly) => void;
	onCtrl?: (ctrl: RenderController) => void;
}





// ## Canvas render setup + interaction
export const CanvasRender: React.FC<RenderProps> = ({
	state,
	onResize = fp.noop,
}) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 100, height: 100 });
	const [transform, setTransform] = useState<ZoomTransform>(loadSaveZoom());
	const zoom = useRef(
		d3zoom()
			.scaleExtent([1, 100])
			.on('zoom', (evt) => {
				setTransform(evt.transform as ZoomTransform);
				debounceSaveZoom(evt.transform);
			})
	);

	const onContainerSize = useCallback((rect) => {
		onResize(rect);
		setContainerSize({
			width: rect.width,
			height: rect.height,
		});
	}, [setContainerSize, onResize]);

	useEffect(() => {
		if (!canvas.current || !state) {
			return;
		}
		const ctx = canvas.current.getContext('2d');
		if (!ctx) {
			return;
		}
		const xform = transform ?? zoomIdentity;
		const rect = canvas.current.getBoundingClientRect();
		renderToContext(ctx, xform, state, rect);
	}, [state, transform]);

	useEffect(() => {
		if (canvas.current && zoom.current) {
			d3select(canvas.current)
			.call(zoom.current as any)
			.call(zoom.current.transform as any, loadSaveZoom());
		}
	}, [canvas, zoom]);

	return (
		<SizedElement onResize={onContainerSize}>
			<canvas ref={canvas} width={containerSize.width} height={containerSize.height} />
		</SizedElement>
	);
};





// ## SVG render setup + interaction
export const SvgRender: React.FC<RenderProps> = ({
	state,
	onResize = fp.noop,
	onCtrl = fp.noop,
}) => {
	const svg = useRef<SVGSVGElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 100, height: 100 });
	const [transform, setTransform] = useState<ZoomTransform>(loadSaveZoom());
	const zoom = useRef(
		d3zoom()
			.scaleExtent([1, 100])
			.on('zoom', (evt) => {
				setTransform(evt.transform as ZoomTransform);
				debounceSaveZoom(evt.transform);
			})
	);

	const renderCtrl = useRef({
		center: () => {
			if (!svg.current?.parentElement || !zoom.current) {
				return;
			}
			const root = svg.current.getElementById('svg-root-transform');
			if (!root) {
				return;
			}

			const maxRect = svg.current.getBoundingClientRect();
			const xform = root.getAttribute('transform') ?? '';
			root.setAttribute('transform', '');
			const contentRect = root.getBoundingClientRect();
			root.setAttribute('transform', xform);

			console.log({
				maxRect,
				contentRect,
			});
			// const maxSize = svg.current.parentElement.getBoundingClientRect();
			// const root = svg.current.getElementById('svg-root-transform');
			// console.log(root.getBoundingClientRect(), maxSize);
			// reset size
		},
	});

	useEffect(() => {
		onCtrl(renderCtrl.current);
	}, [onCtrl]);

	const onContainerSize = useCallback((rect) => {
		onResize(rect);
		setContainerSize({
			width: rect.width,
			height: rect.height,
		});
	}, [setContainerSize, onResize]);

	useEffect(() => {
		if (svg.current) {
			const xform = transform ?? zoomIdentity;
			d3select(svg.current)
					.selectAll('g')
					.data([xform])
					.join('g')
						.attr('transform', fp.identity)
						.attr('id', 'svg-root-transform');
		}
	}, [transform]);

	useEffect(() => {
		if (svg.current && state) {
			const root = svg.current.getElementById('svg-root-transform');
			if (root) {
				renderToSvg(root, state);
			}
		}
	}, [state, transform]);

	useEffect(() => {
		if (svg.current && zoom.current) {
			d3select(svg.current)
				.call(zoom.current as any)
				.call(zoom.current.transform as any, loadSaveZoom());
		}
	}, [svg, zoom]);

	return (
		<SizedElement onResize={onContainerSize}>
			<svg ref={svg} width={containerSize.width} height={containerSize.height} viewBox={`0 0 ${containerSize.width} ${containerSize.height}`} />
		</SizedElement>
	);
};
