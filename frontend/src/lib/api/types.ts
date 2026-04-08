export type ApiListResponse<T> = {
	data: T[];
};

export type ApiItemResponse<T> = {
	data: T;
};

export type ApiMutationResponse<T> = {
	message: string;
	data: T;
};

export type ApiDeleteResponse = {
	message: string;
};

export type ValidationErrors = Record<string, string[]>;

export type ValidationErrorResponse = {
	message: string;
	errors: ValidationErrors;
};

export type PrimitiveQueryValue = string | number | boolean;

export type QueryValue =
	| PrimitiveQueryValue
	| null
	| undefined
	| Array<PrimitiveQueryValue | null | undefined>;

export type QueryParams = Record<string, QueryValue>;

export type DurationHHMMSS = string;

export type TimeHHMMSS = string;

export type TagPivot = {
	activity_id: number;
	tag_id: number;
	activity_tag_id: number;
	activity_tag_date: string;
	tag_value: number | null;
};

export type TagWithPivot = {
	tag_id: number;
	tag_name: string;
	pivot: TagPivot;
};

export type Tag = {
	tag_id: number;
	tag_name: string;
};

export type Activity = {
	activity_id: number;
	activity_date: string;
	activity_point: number;
	activity_description: string;
	tags?: TagWithPivot[];
};

export type ActivityTag = {
	activity_tag_id: number;
	activity_tag_date: string;
	activity_id: number;
	tag_id: number;
	tag_value: number | null;
	activity?: Activity;
	tag?: Tag;
};

export type ActionItem = {
	action_id: number;
	action_name: string;
	'durasi rata-rata': DurationHHMMSS | null;
};

export type Action = ActionItem;

export type Expedition = {
	expedition_id: number;
	action_id: number;
	duration: DurationHHMMSS;
	action?: {
		action_id: number;
		action_name: string;
	};
};

export type Block = {
	block_id: number;
	start_time: TimeHHMMSS;
	duration: DurationHHMMSS;
	prev: number | null;
	next: number | null;
	activity_name: string;
	date: string;
	previous_block?: Block | null;
	next_block?: Block | null;
};

export type ActivityCreatePayload = {
	activity_date: string;
	activity_point: number;
	activity_description: string;
};

export type ActivityPutPayload = ActivityCreatePayload;

export type ActivityPatchPayload = Partial<ActivityCreatePayload>;

export type TagCreatePayload = {
	tag_name: string;
};

export type TagPutPayload = TagCreatePayload;

export type TagPatchPayload = Partial<TagCreatePayload>;

export type ActivityTagCreatePayload = {
	activity_tag_date: string;
	activity_id: number;
	tag_id: number;
	tag_value: number | null;
};

export type ActivityTagPutPayload = ActivityTagCreatePayload;

export type ActivityTagPatchPayload = Partial<ActivityTagCreatePayload>;

export type ActionCreatePayload = {
	action_name: string;
};

export type ActionPutPayload = ActionCreatePayload;

export type ActionPatchPayload = Partial<ActionCreatePayload>;

export type ExpeditionCreatePayload = {
	action_id: number;
	duration: DurationHHMMSS;
};

export type ExpeditionPutPayload = ExpeditionCreatePayload;

export type ExpeditionPatchPayload = Partial<ExpeditionCreatePayload>;

export type BlockCreatePayload = {
	start_time: TimeHHMMSS;
	duration: DurationHHMMSS;
	prev: number | null;
	next: number | null;
	activity_name: string;
	date: string;
};

export type BlockPutPayload = BlockCreatePayload;

export type BlockPatchPayload = Partial<BlockCreatePayload>;

export type ActivityTagListQuery = {
	activity_id?: number;
	tag_id?: number;
	activity_tag_date?: string;
};

export type ExpeditionListQuery = {
	action_id?: number;
};

export type BlockListQuery = {
	date?: string;
};
