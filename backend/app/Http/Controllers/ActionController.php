<?php

namespace App\Http\Controllers;

use App\Models\Action;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ActionController extends Controller
{
    public function index(): JsonResponse
    {
        $actions = Action::query()
            ->with(['expeditions' => function ($query) {
                $query->select(['expedition_id', 'action_id', 'duration']);
            }])
            ->orderBy('action_name')
            ->orderBy('action_id')
            ->get();

        return response()->json([
            'data' => $actions->map(fn (Action $action): array => $this->transformAction($action)),
        ]);
    }

    public function show(int $actionId): JsonResponse
    {
        $action = Action::query()
            ->with(['expeditions' => function ($query) {
                $query->select(['expedition_id', 'action_id', 'duration']);
            }])
            ->find($actionId);

        if (! $action) {
            return response()->json([
                'message' => 'Action tidak ditemukan.',
            ], 404);
        }

        return response()->json([
            'data' => $this->transformAction($action),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action_name' => ['required', 'string', 'max:255'],
        ]);

        $action = Action::query()->create($validated);

        return response()->json([
            'message' => 'Action berhasil dibuat.',
            'data' => $this->transformAction($action->load('expeditions')),
        ], 201);
    }

    public function update(Request $request, int $actionId): JsonResponse
    {
        $action = Action::query()->find($actionId);

        if (! $action) {
            return response()->json([
                'message' => 'Action tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'action_name' => ['sometimes', 'required', 'string', 'max:255'],
        ]);

        $action->update($validated);

        return response()->json([
            'message' => 'Action berhasil diperbarui.',
            'data' => $this->transformAction($action->fresh()->load('expeditions')),
        ]);
    }

    public function destroy(int $actionId): JsonResponse
    {
        $action = Action::query()->find($actionId);

        if (! $action) {
            return response()->json([
                'message' => 'Action tidak ditemukan.',
            ], 404);
        }

        $action->delete();

        return response()->json([
            'message' => 'Action berhasil dihapus.',
        ]);
    }

    private function transformAction(Action $action): array
    {
        return [
            'action_id' => (int) $action->action_id,
            'action_name' => $action->action_name,
            'durasi rata-rata' => $this->calculateAverageDuration($action->expeditions),
        ];
    }

    private function calculateAverageDuration(Collection $expeditions): ?string
    {
        $durationsInSeconds = $expeditions
            ->pluck('duration')
            ->map(fn ($duration) => $this->durationToSeconds((string) $duration))
            ->filter(fn ($duration) => $duration !== null)
            ->values();

        if ($durationsInSeconds->isEmpty()) {
            return null;
        }

        $averageSeconds = (int) round((float) $durationsInSeconds->avg());

        return $this->secondsToDuration($averageSeconds);
    }

    private function durationToSeconds(string $duration): ?int
    {
        if (preg_match('/^\d{1,3}:[0-5]\d:[0-5]\d$/', $duration)) {
            [$hours, $minutes, $seconds] = explode(':', $duration);

            return ((int) $hours * 3600) + ((int) $minutes * 60) + (int) $seconds;
        }

        if (preg_match('/^\d{1,3}:[0-5]\d$/', $duration)) {
            [$hours, $minutes] = explode(':', $duration);

            return ((int) $hours * 3600) + ((int) $minutes * 60);
        }

        return null;
    }

    private function secondsToDuration(int $seconds): string
    {
        $safeSeconds = max(0, $seconds);
        $hours = intdiv($safeSeconds, 3600);
        $remainingSeconds = $safeSeconds % 3600;
        $minutes = intdiv($remainingSeconds, 60);
        $secondsOnly = $remainingSeconds % 60;

        return sprintf('%02d:%02d:%02d', $hours, $minutes, $secondsOnly);
    }
}
