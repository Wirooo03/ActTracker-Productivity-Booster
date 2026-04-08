<?php

namespace App\Http\Controllers;

use App\Models\Expedition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpeditionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Expedition::query()->with('action');

        if ($request->filled('action_id')) {
            $query->where('action_id', (int) $request->input('action_id'));
        }

        $expeditions = $query
            ->orderBy('expedition_id', 'desc')
            ->get();

        return response()->json(['data' => $expeditions]);
    }

    public function show(int $expeditionId): JsonResponse
    {
        $expedition = Expedition::query()
            ->with('action')
            ->find($expeditionId);

        if (! $expedition) {
            return response()->json([
                'message' => 'Expedition tidak ditemukan.',
            ], 404);
        }

        return response()->json(['data' => $expedition]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action_id' => ['required', 'integer', 'exists:action,action_id'],
            'duration' => ['required', 'string', 'regex:/^\d{1,2}:[0-5]\d(:[0-5]\d)?$/'],
        ]);

        $validated['duration'] = $this->normalizeDuration((string) $validated['duration']);

        $expedition = Expedition::query()->create($validated);

        return response()->json([
            'message' => 'Expedition berhasil dibuat.',
            'data' => $expedition->fresh('action'),
        ], 201);
    }

    public function update(Request $request, int $expeditionId): JsonResponse
    {
        $expedition = Expedition::query()->find($expeditionId);

        if (! $expedition) {
            return response()->json([
                'message' => 'Expedition tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'action_id' => ['sometimes', 'required', 'integer', 'exists:action,action_id'],
            'duration' => ['sometimes', 'required', 'string', 'regex:/^\d{1,2}:[0-5]\d(:[0-5]\d)?$/'],
        ]);

        if (array_key_exists('duration', $validated)) {
            $validated['duration'] = $this->normalizeDuration((string) $validated['duration']);
        }

        $expedition->update($validated);

        return response()->json([
            'message' => 'Expedition berhasil diperbarui.',
            'data' => $expedition->fresh('action'),
        ]);
    }

    public function destroy(int $expeditionId): JsonResponse
    {
        $expedition = Expedition::query()->find($expeditionId);

        if (! $expedition) {
            return response()->json([
                'message' => 'Expedition tidak ditemukan.',
            ], 404);
        }

        $expedition->delete();

        return response()->json([
            'message' => 'Expedition berhasil dihapus.',
        ]);
    }

    private function normalizeDuration(string $duration): string
    {
        if (preg_match('/^(\d{1,2}):([0-5]\d)$/', $duration, $matches)) {
            return sprintf('%02d:%s:00', (int) $matches[1], $matches[2]);
        }

        if (preg_match('/^(\d{1,2}):([0-5]\d):([0-5]\d)$/', $duration, $matches)) {
            return sprintf('%02d:%s:%s', (int) $matches[1], $matches[2], $matches[3]);
        }

        return $duration;
    }
}
