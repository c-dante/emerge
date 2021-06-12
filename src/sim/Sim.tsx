import React from 'react';
import fp from 'lodash/fp';
import { KdTreeMap } from '@thi.ng/geom-accel';
import { CanvasRender, SvgRender } from './render';
import { addThing, cloud, FixedControls, seed, SimState, Thing, water } from './things';

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

const STORAGE = 'SIM_STORAGE';
export type SimEltState = {
	sim: SimState;
	intervalRate: number;
	canvasRect?: DOMRectReadOnly;
}
export type SimProps = {};
export class Sim extends React.Component<SimProps, SimEltState> {
	interval: NodeJS.Timeout | undefined;

	constructor(initialProps: SimProps) {
		super(initialProps);
		this.state = {
			sim: emptyState(),
			intervalRate: 1000,
		};

		const saved = sessionStorage.getItem(STORAGE);
		if (saved) {
			try {
				console.log(saved);
				this.setState({
					sim: deserializeState(saved),
				});
			} catch (error) {
				console.debug(saved);
				console.warn('Failed to load json', error);
			}
		}
	}

	componentDidMount() {
		this.interval = setInterval(() => {
			const nextState = advanceSim(this.state.sim, 1);

			if (this.state.sim.tick % 10 === 0) {
				sessionStorage.setItem(STORAGE, serializeState(nextState));
			}

			this.setState({
				sim: { ...nextState },
			});
		}, 1000);
	}

	componentWillUnmount() {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
	}

	setCanvasDims(rect: DOMRectReadOnly) {
		this.setState({
			canvasRect: rect,
		});
	}

	render() {
		return (
			<div className="sim-container">
				<div className="sim-render-area">
					{/* <CanvasRender state={this.state.sim} onResize={dims => this.setCanvasDims(dims)} /> */}
					<SvgRender state={this.state.sim} onResize={dims => this.setCanvasDims(dims)} />
					{/* {[...this.state.things.values()].flatMap((things, i) => (
						things.map((thing, j) => (
							<DisplayThing thing={thing} key={`${i},${j}`} />
						))
					))} */}
				</div>

				<div className="sim-stats-footer">
					<p>{this.state.sim.tick}</p>
					<button onClick={() => this.setState({ sim: emptyState()} )}>Reset</button>
					<p>Size: {this.state.canvasRect?.width} x {this.state.canvasRect?.height}</p>
					{/* <label>
						interval (ms)
						<input type='text' value={this.intervalRate} />
					</label> */}
				</div>
			</div>
		);
	}
}
