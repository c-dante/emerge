import fp from 'lodash';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { zoom as d3zoom, zoomIdentity, ZoomTransform } from 'd3-zoom';
import { select as d3select } from 'd3-selection';
import { SimState, ThingType } from './things';

const PADDING = 1;
const SCALE = 10;
const HALF_SCALE = SCALE / 2;

type SizedElementProps = {
	onResize?: (rect: DOMRectReadOnly) => void,
	containerProps?: object,
};
const SizedElement: React.FC<SizedElementProps> = ({
	onResize = fp.noop,
	children,
	containerProps = {
		style: {
			height: '100%',
		},
	},
}) => {
	const container = useRef<HTMLDivElement>(null);
	const localOnResize = useRef(onResize);
	useEffect(() => {
		localOnResize.current = onResize;
	}, [onResize]);

	const observer = useRef(new ResizeObserver(entries => {
		if (entries.length > 0) {
			const contentRect = entries[0].contentRect;
			localOnResize.current(contentRect);
		}
	}));

	useEffect(() => {
		if (!container.current?.parentElement) {
			return;
		}

		const obs = observer.current;
		obs.observe(container.current.parentElement);
		return () => obs.disconnect();
	}, [container, observer]);

	return (
		<div {...containerProps} ref={container}>
			{children}
		</div>
	);
};

export type RenderProps = {
	state: SimState;
	onResize?: (rect: DOMRectReadOnly) => void;
}
export const CanvasRender: React.FC<RenderProps> = ({
	state,
	onResize = fp.noop,
}) => {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 100, height: 100 });
	const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
	const zoom = useRef(
		d3zoom()
			.scaleExtent([1, 100])
			.on('zoom', (evt) => {
				setTransform(evt.transform as ZoomTransform);
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
		if (canvas.current && state) {
			const xform = transform ?? zoomIdentity;
			const ctx = canvas.current.getContext('2d');
			const rect = canvas.current.getBoundingClientRect();
			ctx?.clearRect(0, 0, rect.width, rect.height);
			ctx?.save();
			ctx?.translate(xform.x, xform.y);
			ctx?.scale(xform.k, xform.k);
			for (const [[x, y], thing] of state.things) {
				ctx?.fillRect(x * (SCALE + PADDING) - HALF_SCALE, y * (SCALE + PADDING) - HALF_SCALE, SCALE, SCALE);
			}
			ctx?.restore();
		}
	}, [state, transform]);

	useEffect(() => {
		if (canvas.current && zoom.current) {
			d3select(canvas.current).call(zoom.current as any);
		}
	}, [canvas, zoom]);

	return (
		<SizedElement onResize={onContainerSize}>
			<canvas ref={canvas} width={containerSize.width} height={containerSize.height} />
		</SizedElement>
	);
};

const TypeToColor = {
	[ThingType.Cloud]: 'lightblue',
	[ThingType.RainCloud]: 'slategrey',
	[ThingType.Root]: 'brown',
	[ThingType.Seed]: 'orange',
	[ThingType.Water]: 'blue',
};


export const SvgRender: React.FC<RenderProps> = ({
	state,
	onResize = fp.noop,
}) => {
	const svg = useRef<SVGSVGElement>(null);
	const [containerSize, setContainerSize] = useState({ width: 100, height: 100 });
	const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
	const zoom = useRef(
		d3zoom()
			.scaleExtent([1, 100])
			.on('zoom', (evt) => {
				setTransform(evt.transform as ZoomTransform);
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
		if (svg.current && state) {
			const xform = transform ?? zoomIdentity;

			d3select(svg.current)
				.selectAll('g')
				.data([xform])
				.join('g')
					.attr('transform', fp.identity)
				.selectAll('rect')
				.data([...state.things.values()].flat())
				// Everything is a rectangle I guess
				.join('rect')
					.attr('x', thing => thing.pos[0] * (SCALE + 1) - HALF_SCALE)
					.attr('y', thing => thing.pos[1] * (SCALE + 1) - HALF_SCALE)
					.attr('width', SCALE)
					.attr('height', SCALE)
					.attr('fill', thing => TypeToColor[thing.type]);

		}
	}, [state, transform]);

	useEffect(() => {
		if (svg.current && zoom.current) {
			d3select(svg.current).call(zoom.current as any);
		}
	}, [svg, zoom]);

	return (
		<SizedElement onResize={onContainerSize}>
			<svg ref={svg} width={containerSize.width} height={containerSize.height} viewBox={`0 0 ${containerSize.width} ${containerSize.height}`} />
		</SizedElement>
	);
};
