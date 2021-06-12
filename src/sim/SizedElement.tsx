import fp from 'lodash';
import React, { useEffect, useRef } from 'react';

export type SizedElementProps = {
	onResize?: (rect: DOMRectReadOnly) => void,
	containerProps?: object,
};

export const SizedElement: React.FC<SizedElementProps> = ({
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