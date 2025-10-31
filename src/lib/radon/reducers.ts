import { type RadonFilter, Stdev as StdevFilter } from "./filters.js";
import type { RadonScript } from "./types.js";

export enum Opcodes {
	Mode = 0x02,
	MeanAverage = 0x03,
	MedianAverage = 0x05,
	StandardDeviation = 0x07,
	ConcatenateAndHash = 0x0b,
}

export interface Specs {
	filters?: RadonFilter[];
	script?: RadonScript;
}

export class RadonReducer {
	readonly opcode: Opcodes;
	readonly filters?: RadonFilter[];

	constructor(opcode: Opcodes, filters?: RadonFilter[]) {
		this.opcode = opcode;
		this.filters = filters;
		Object.defineProperty(this, "toString", {
			value: () => {
				let filters = "";
				this.filters?.map((filter) => {
					filters = `${filter.toString()}${filters ? `.${filters}` : ""}`;
				});
				if (filters) filters = `${filters}.`;
				switch (this.opcode) {
					case Opcodes.Mode:
						return `${filters}Mode()`;
					case Opcodes.MeanAverage:
						return `${filters}Mean()`;
					case Opcodes.MedianAverage:
						return `${filters}Median()`;
					case Opcodes.StandardDeviation:
						return `${filters}Stdev()`;
					case Opcodes.ConcatenateAndHash:
						return `${filters}ConcatHash()`;
				}
			},
		});
	}

	public toJSON(humanize?: boolean): any {
		const json: any = {
			reducer: humanize ? Opcodes[this.opcode] : this.opcode,
		};
		json.filters = this.filters?.map((filter) => filter.toJSON(humanize)) || [];
		return json;
	}

	public toProtobuf(): any {
		const protobuf: any = {
			reducer: this.opcode,
		};
		if (this.filters && this.filters.length > 0) {
			protobuf.filters = this.filters.map((filter) => filter.toProtobuf());
		}
		return protobuf;
	}

	public opsCount(): number {
		return 1 + (this.filters?.length || 0);
	}
}

export function Mode(...filters: RadonFilter[]) {
	return new RadonReducer(Opcodes.Mode, filters);
}
export function Mean(...filters: RadonFilter[]) {
	return new RadonReducer(Opcodes.MeanAverage, filters);
}
export function Median(...filters: RadonFilter[]) {
	return new RadonReducer(Opcodes.MedianAverage, filters);
}
export function Stdev(...filters: RadonFilter[]) {
	return new RadonReducer(Opcodes.StandardDeviation, filters);
}
export function ConcatHash(...filters: RadonFilter[]) {
	return new RadonReducer(Opcodes.ConcatenateAndHash, filters);
}

export function PriceAggregate() {
	return new RadonReducer(Opcodes.MeanAverage, [StdevFilter(1.4)]);
}
export function PriceTally() {
	return new RadonReducer(Opcodes.MeanAverage, [StdevFilter(2.5)]);
}
