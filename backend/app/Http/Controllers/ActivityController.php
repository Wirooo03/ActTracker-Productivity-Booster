<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityController extends Controller
{
    public function index(): JsonResponse
    {
        $activities = Activity::query()
            ->with('tags')
            ->orderBy('activity_date', 'desc')
            ->orderBy('activity_id', 'desc')
            ->get();

        return response()->json(['data' => $activities]);
    }

    public function getByDate(string $date): JsonResponse
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return response()->json([
                'message' => 'Format date harus YYYY-MM-DD.',
            ], 422);
        }

        $activities = Activity::query()
            ->with('tags')
            ->whereDate('activity_date', $date)
            ->orderBy('activity_id', 'desc')
            ->get();

        return response()->json(['data' => $activities]);
    }

    public function getByMonthYear(int $year, int $month): JsonResponse
    {
        if ($year < 1000 || $year > 9999) {
            return response()->json([
                'message' => 'Year harus 4 digit.',
            ], 422);
        }

        if ($month < 1 || $month > 12) {
            return response()->json([
                'message' => 'Month harus 1 sampai 12.',
            ], 422);
        }

        $activities = Activity::query()
            ->with('tags')
            ->whereYear('activity_date', $year)
            ->whereMonth('activity_date', $month)
            ->orderBy('activity_date')
            ->orderBy('activity_id')
            ->get();

        return response()->json(['data' => $activities]);
    }

    public function show(int $activityId): JsonResponse
    {
        $activity = Activity::query()
            ->with('tags')
            ->find($activityId);

        if (! $activity) {
            return response()->json([
                'message' => 'Activity tidak ditemukan.',
            ], 404);
        }

        return response()->json(['data' => $activity]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'activity_date' => ['required', 'date'],
            'activity_point' => ['required', 'integer'],
            'activity_description' => ['required', 'string', 'max:255'],
        ]);

        $activity = Activity::query()->create($validated);

        return response()->json([
            'message' => 'Activity berhasil dibuat.',
            'data' => $activity->fresh('tags'),
        ], 201);
    }

    public function update(Request $request, int $activityId): JsonResponse
    {
        $activity = Activity::query()->find($activityId);

        if (! $activity) {
            return response()->json([
                'message' => 'Activity tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'activity_date' => ['sometimes', 'required', 'date'],
            'activity_point' => ['sometimes', 'required', 'integer'],
            'activity_description' => ['sometimes', 'required', 'string', 'max:255'],
        ]);

        $activity->update($validated);

        return response()->json([
            'message' => 'Activity berhasil diperbarui.',
            'data' => $activity->fresh('tags'),
        ]);
    }

    public function destroy(int $activityId): JsonResponse
    {
        $activity = Activity::query()->find($activityId);

        if (! $activity) {
            return response()->json([
                'message' => 'Activity tidak ditemukan.',
            ], 404);
        }

        $activity->delete();

        return response()->json([
            'message' => 'Activity berhasil dihapus.',
        ]);
    }
}
