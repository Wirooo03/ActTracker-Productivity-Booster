<?php

namespace App\Http\Controllers;

use App\Models\ActivityTag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityTagController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ActivityTag::query()->with(['activity', 'tag']);

        if ($request->filled('activity_id')) {
            $query->where('activity_id', (int) $request->input('activity_id'));
        }

        if ($request->filled('tag_id')) {
            $query->where('tag_id', (int) $request->input('tag_id'));
        }

        if ($request->filled('activity_tag_date')) {
            $query->whereDate('activity_tag_date', (string) $request->input('activity_tag_date'));
        }

        $activityTags = $query
            ->orderBy('activity_tag_date', 'desc')
            ->orderBy('activity_tag_id', 'desc')
            ->get();

        return response()->json(['data' => $activityTags]);
    }

    public function show(int $activityTagId): JsonResponse
    {
        $activityTag = ActivityTag::query()
            ->with(['activity', 'tag'])
            ->find($activityTagId);

        if (! $activityTag) {
            return response()->json([
                'message' => 'Relasi activity-tag tidak ditemukan.',
            ], 404);
        }

        return response()->json(['data' => $activityTag]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'activity_tag_date' => ['required', 'date'],
            'activity_id' => ['required', 'integer', 'exists:activity,activity_id'],
            'tag_id' => ['required', 'integer', 'exists:tag,tag_id'],
            'tag_value' => ['nullable', 'numeric'],
        ]);

        $activityTag = ActivityTag::query()->create($validated);

        return response()->json([
            'message' => 'Relasi activity-tag berhasil dibuat.',
            'data' => $activityTag->fresh(['activity', 'tag']),
        ], 201);
    }

    public function update(Request $request, int $activityTagId): JsonResponse
    {
        $activityTag = ActivityTag::query()->find($activityTagId);

        if (! $activityTag) {
            return response()->json([
                'message' => 'Relasi activity-tag tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'activity_tag_date' => ['sometimes', 'required', 'date'],
            'activity_id' => ['sometimes', 'required', 'integer', 'exists:activity,activity_id'],
            'tag_id' => ['sometimes', 'required', 'integer', 'exists:tag,tag_id'],
            'tag_value' => ['sometimes', 'nullable', 'numeric'],
        ]);

        $activityTag->update($validated);

        return response()->json([
            'message' => 'Relasi activity-tag berhasil diperbarui.',
            'data' => $activityTag->fresh(['activity', 'tag']),
        ]);
    }

    public function destroy(int $activityTagId): JsonResponse
    {
        $activityTag = ActivityTag::query()->find($activityTagId);

        if (! $activityTag) {
            return response()->json([
                'message' => 'Relasi activity-tag tidak ditemukan.',
            ], 404);
        }

        $activityTag->delete();

        return response()->json([
            'message' => 'Relasi activity-tag berhasil dihapus.',
        ]);
    }
}
