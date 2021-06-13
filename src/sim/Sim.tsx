import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ChangeEvent as ReactChangeEvent } from 'react';
import fp from 'lodash/fp';
import { KdTreeMap } from '@thi.ng/geom-accel';
import { RenderController, CanvasRender, SvgRender } from './render';
import { addThing, cloud, FixedControls, seed, SimState, Thing, water } from './things';
import { Fps } from './fps';
import './Sim.css';

// -- Sim
export type SerializedSimState = string;
const serializeState = (state: SimState): SerializedSimState => {
	return JSON.stringify({
		...state,
		things: [...state.things],
	});
};
const deserializeState = (serialized: string): SimState => {
	const intermediate = JSON.parse(serialized);

	// Deserialize things
	const interThings = (intermediate.things as [number[], Thing[]][]);
	const things = new KdTreeMap(2, interThings);
	return {
		tick: intermediate.tick as number,
		things,
	};
};

const advanceSim = (state: SimState, delta: number): SimState => {
	state.tick += delta;
	for (const [, things] of state.things) {
		// Randomly shuffle the things so we don't bias who goes first
		fp.shuffle(things).forEach(thing => {
			(FixedControls[thing.type] ?? []).forEach((ctrl) => ctrl(thing, state, delta));
		});
	}
	return state;
};

const emptyState = () => ({
	things: [
		water(),
		water(),
		water(),
		water(),
		water(),
		// A seed
		seed(),
		// A cloud
		cloud([0, -1]),
	].reduce((thingMap, thing) => addThing(thing, thingMap), new KdTreeMap<number[], Thing[]>(2)),
	tick: 0,
});

/*
-------- whatever. render and game loop
*/

// const DisplayThing = ({ thing }: { thing: Thing }) => (
// 	<div style={{
// 		position: 'absolute',
// 		left: thing.pos[0] * 50,
// 		top: thing.pos[1] * 50,
// 	}}>
// 		{thing.type}
// 		<ul className="thing-list">
// 			{Object.keys(thing.resources).map((key) => (
// 				<li key={key}>{key}: {String(thing.resources[key as ThingType])}</li>
// 			))}
// 		</ul>
// 	</div>
// );

const GAME_SAVE = 'SIM_STORAGE';
// const SETTINGS_SAVE = 'SIM_SETTINGS';
export const Sim: React.FC = () => {
	// ------ State
	const [saveFile] = useState(GAME_SAVE);
	const [intervalRate, setIntervalRate] = useState(1000);
	const [tick, setTick] = useState(0);
	const [renderCtrl, setRenderCtrl] = useState<RenderController>();
	const [canvasRect, setRenderRect] = useState<DOMRectReadOnly>();

	const sim = useRef(emptyState());
	const drawFps = useRef(new Fps());
	const renderFps = useRef(new Fps());
	const simFps = useRef(new Fps());


	// ------ Callbacks
	const validateInput = useCallback((e: ReactChangeEvent<HTMLInputElement>) => {
		const interval = +e.target.value;
		if (!isNaN(interval)) {
			const newRate = Math.min(
				Math.max(10, interval),
				10000
			);
			setIntervalRate(newRate);
		}
	}, [setIntervalRate]);

	const resetSim = useCallback(() => {
		sim.current = emptyState();
		setTick(sim.current.tick);
	}, [sim]);


	// ------ Effects
	useEffect(() => {
		const saved = sessionStorage.getItem(saveFile);
		if (saved) {
			try {
				sim.current = deserializeState(saved);
				setTick(sim.current.tick);
			} catch (error) {
				console.debug(saved);
				console.warn('Failed to load json', error);
			}
		}
	}, [saveFile, sim]);

	useEffect(() => {
		const interval = setInterval(() => {
			renderFps.current.update();

			simFps.current.zero();
			sim.current = { ...advanceSim(sim.current, 1) };
			simFps.current.update();

			if (sim.current.tick % 10 === 0) {
				sessionStorage.setItem(saveFile, serializeState(sim.current));
			}

			setTick(sim.current.tick);
		}, intervalRate);

		return () => {
			clearInterval(interval);
		};
	}, [saveFile, intervalRate, setIntervalRate, simFps]);



	return (
		<div className="sim-container">
			<div className="sim-render-area">
				<CanvasRender
					state={sim.current}
					onResize={setRenderRect}
					onCtrl={setRenderCtrl}
					// onMouse={onGameMouseEventCb}
					drawFps={drawFps.current}
					renderFps={renderFps.current}
				/>
				{/* <SvgRender
					state={sim.current}
					onResize={setRenderRect}
					onCtrl={setRenderCtrl}
					drawFps={drawFps.current}
					renderFps={renderFps.current}
				/> */}
			</div>

			<div className="sim-stats-footer">
				<p>{tick}</p>
				<button onClick={resetSim}>Reset</button>
				<p>Size: {canvasRect?.width} x {canvasRect?.height}</p>
				<button disabled={!renderCtrl} onClick={() => renderCtrl?.center()}>Center</button>
				<button onClick={() => console.log({ saveFile, sim, canvasRect, renderCtrl, intervalRate })}>Log</button>
				<label>
					interval (ms)
					<input
						type='text'
						value={intervalRate}
						onChange={validateInput}
					/>
				</label>
				<div style={{ width: '11em', overflow: 'hidden'}}>
					<div>Render: {drawFps.current.rate.toFixed(0)} ms</div>
					<div>Sim: {simFps.current.rate.toFixed(0)} ms</div>
				</div>
				<div style={{ width: '11em', overflow: 'hidden'}}>
					<div>FPS: {Math.round(renderFps.current.fps)} fps</div>
				</div>
			</div>
		</div>
	);
};