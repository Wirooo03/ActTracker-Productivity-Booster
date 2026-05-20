export type ApiMeta = Record<string, unknown>;

export type ApiPaginationMeta = {
	page?: number;
	per_page?: number;
	total?: number;
	last_page?: number;
	has_more?: boolean;
	[key: string]: unknown;
};

export type ApiListResponse<T, TMeta extends ApiMeta = ApiMeta> = {
	data: T[];
	meta?: TMeta;
	links?: Record<string, string | null | undefined>;
};

export type ApiItemResponse<T, TMeta extends ApiMeta = ApiMeta> = {
	data: T;
	meta?: TMeta;
};

export type ApiMutationResponse<T, TMeta extends ApiMeta = ApiMeta> = {
	message: string;
	data: T;
	meta?: TMeta;
};

export type ApiDeleteResponse<TMeta extends ApiMeta = ApiMeta> = {
	message: string;
	meta?: TMeta;
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

export type ListQuery = {
	search?: string;
	page?: number;
	per_page?: number;
	fields?: string | string[];
};

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

export type GroupTagPivot = {
	group_id: number;
	tag_id: number;
	tag_groups_id: number;
};

export type GroupTag = Tag & {
	pivot?: GroupTagPivot;
};

export type GroupSummary = {
	group_id: number;
	group_name: string;
};

export type Group = GroupSummary & {
	tags?: GroupTag[];
};

export type TagGroup = {
	tag_groups_id: number;
	tag_id: number;
	group_id: number;
	tag?: Tag;
	group?: GroupSummary;
};

export type TemplateSummary = {
	template_id: number;
	template_name: string;
};

export type TemplateTag = {
	template_tags_id: number;
	template_id: number;
	tag_id: number;
	points: number;
	tag?: Tag;
	template?: TemplateSummary;
};

export type Template = TemplateSummary & {
	template_tags?: TemplateTag[];
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

export type GroupCreatePayload = {
	group_name: string;
};

export type GroupPutPayload = GroupCreatePayload;

export type GroupPatchPayload = Partial<GroupCreatePayload>;

export type TagGroupCreatePayload = {
	tag_id: number;
	group_id: number;
};

export type TagGroupPutPayload = TagGroupCreatePayload;

export type TagGroupPatchPayload = Partial<TagGroupCreatePayload>;

export type TemplateTagInputPayload = {
	tag_id: number;
	points: number;
};

export type TemplateCreatePayload = {
	template_name: string;
	template_tags?: TemplateTagInputPayload[];
};

export type TemplatePutPayload = TemplateCreatePayload;

export type TemplatePatchPayload = Partial<TemplateCreatePayload>;

export type TemplateTagCreatePayload = {
	template_id: number;
	tag_id: number;
	points: number;
};

export type TemplateTagPutPayload = TemplateTagCreatePayload;

export type TemplateTagPatchPayload = Partial<TemplateTagCreatePayload>;

export type ActionItem = {
	action_id: number;
	action_name: string;
	'durasi rata-rata'?: DurationHHMMSS | null;
	average_duration?: DurationHHMMSS | null;
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
	tag_relations?: Array<{
		tag_id: number;
		tag_value?: number | null;
		activity_tag_date?: string;
	}>;
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
	date_from?: string;
	date_to?: string;
	tag_ids?: number[];
	activity_ids?: number[];
	include?: string | string[];
	page?: number;
	per_page?: number;
	fields?: string | string[];
};

export type GroupListQuery = ListQuery & {
	include?: string | string[];
};

export type TagGroupListQuery = {
	tag_id?: number;
	group_id?: number;
	include?: string | string[];
	page?: number;
	per_page?: number;
	fields?: string | string[];
};

export type TemplateListQuery = ListQuery & {
	include?: string | string[];
};

export type TemplateTagListQuery = {
	template_id?: number;
	tag_id?: number;
	include?: string | string[];
	page?: number;
	per_page?: number;
	fields?: string | string[];
};

export type CreateActivityFromTemplateRequest = {
	activity_date: string;
	activity_description?: string;
	activity_point?: number;
};

export type CreateActivityFromTemplateMeta = {
	template_id: number;
	template_name: string;
	[key: string]: unknown;
};

export type CreateActivityFromTemplateResponse = ApiMutationResponse<
	Activity,
	CreateActivityFromTemplateMeta
>;

export type ExpeditionListQuery = {
	action_id?: number;
	include?: string | string[];
	page?: number;
	per_page?: number;
	fields?: string | string[];
};

export type BlockListQuery = {
	date?: string;
	include?: string | string[];
	page?: number;
	per_page?: number;
	fields?: string | string[];
};

export type ActionListQuery = ListQuery;

export type TagListQuery = ListQuery;

export type ActivityListQuery = ListQuery & {
	date?: string;
	date_from?: string;
	date_to?: string;
};

export type ExpeditionMutationMeta = {
	changed_actions?: Array<{
		action_id: number;
		average_duration?: DurationHHMMSS | null;
		'durasi rata-rata'?: DurationHHMMSS | null;
	}>;
	snapshot?: {
		expeditions?: Expedition[];
	};
	[key: string]: unknown;
};

export type BlockMutationMeta = {
	affected_dates?: string[];
	snapshot?: {
		blocks?: Block[];
	};
	[key: string]: unknown;
};

export type MutationRequestOptions = {
	includeSnapshot?: boolean;
};

export type WinPointsSeriesPoint = {
	date: string;
	total_point: number;
};

export type WinPointsSeriesMeta = {
	from: string;
	to: string;
	days: number;
	timezone: string;
	[key: string]: unknown;
};

export type WinPointsSeriesQuery = {
	from: string;
	to: string;
};

export type MilestoneCellState = 'missing' | 'check' | 'cross' | 'mixed' | 'value';

export type WinMilestoneMatrixCell = {
	tag_id: number;
	date: string;
	state: MilestoneCellState;
	value: number | null;
};

export type WinMilestoneMatrixData = {
	tags: Tag[];
	dates: string[];
	cells: WinMilestoneMatrixCell[];
};

export type PlanBootstrapAction = {
	action_id: number;
	action_name: string;
	average_duration?: DurationHHMMSS | null;
	'durasi rata-rata'?: DurationHHMMSS | null;
};

export type PlanDayBootstrapData = {
	date: string;
	blocks: Block[];
	actions: PlanBootstrapAction[];
};
