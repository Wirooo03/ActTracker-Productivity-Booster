<?php

namespace App\Http\Controllers;

use App\Models\Block;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlockController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Block::query()->with(['previousBlock', 'nextBlock']);

        if ($request->filled('date')) {
            $query->whereDate('date', (string) $request->input('date'));
        }

        $blocks = $query
            ->orderBy('date')
            ->orderBy('start_time')
            ->orderBy('block_id')
            ->get();

        return response()->json(['data' => $blocks]);
    }

    public function show(int $blockId): JsonResponse
    {
        $block = Block::query()
            ->with(['previousBlock', 'nextBlock'])
            ->find($blockId);

        if (! $block) {
            return response()->json([
                'message' => 'Block tidak ditemukan.',
            ], 404);
        }

        return response()->json(['data' => $block]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start_time' => ['required', 'string', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'duration' => ['required', 'string', 'regex:/^\d{1,2}:[0-5]\d(:[0-5]\d)?$/'],
            'prev' => ['nullable', 'integer', 'exists:block,block_id'],
            'next' => ['nullable', 'integer', 'exists:block,block_id'],
            'activity_name' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date'],
        ]);

        $validated['start_time'] = $this->normalizeStartTime((string) $validated['start_time']);
        $validated['duration'] = $this->normalizeDuration((string) $validated['duration']);

        $block = Block::query()->create($validated);

        return response()->json([
            'message' => 'Block berhasil dibuat.',
            'data' => $block->fresh(['previousBlock', 'nextBlock']),
        ], 201);
    }

    public function update(Request $request, int $blockId): JsonResponse
    {
        $block = Block::query()->find($blockId);

        if (! $block) {
            return response()->json([
                'message' => 'Block tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'start_time' => ['sometimes', 'required', 'string', 'regex:/^\d{2}:\d{2}(:\d{2})?$/'],
            'duration' => ['sometimes', 'required', 'string', 'regex:/^\d{1,2}:[0-5]\d(:[0-5]\d)?$/'],
            'prev' => ['sometimes', 'nullable', 'integer', 'exists:block,block_id'],
            'next' => ['sometimes', 'nullable', 'integer', 'exists:block,block_id'],
            'activity_name' => ['sometimes', 'required', 'string', 'max:255'],
            'date' => ['sometimes', 'required', 'date'],
        ]);

        if (array_key_exists('prev', $validated) && (int) $validated['prev'] === $blockId) {
            return response()->json([
                'message' => 'prev tidak boleh sama dengan block_id sendiri.',
            ], 422);
        }

        if (array_key_exists('next', $validated) && (int) $validated['next'] === $blockId) {
            return response()->json([
                'message' => 'next tidak boleh sama dengan block_id sendiri.',
            ], 422);
        }

        if (array_key_exists('start_time', $validated)) {
            $validated['start_time'] = $this->normalizeStartTime((string) $validated['start_time']);
        }

        if (array_key_exists('duration', $validated)) {
            $validated['duration'] = $this->normalizeDuration((string) $validated['duration']);
        }

        $block->update($validated);

        return response()->json([
            'message' => 'Block berhasil diperbarui.',
            'data' => $block->fresh(['previousBlock', 'nextBlock']),
        ]);
    }

    public function destroy(int $blockId): JsonResponse
    {
        $block = Block::query()->find($blockId);

        if (! $block) {
            return response()->json([
                'message' => 'Block tidak ditemukan.',
            ], 404);
        }

        $block->delete();

        return response()->json([
            'message' => 'Block berhasil dihapus.',
        ]);
    }

    private function normalizeStartTime(string $startTime): string
    {
        if (preg_match('/^\d{2}:\d{2}$/', $startTime)) {
            return $startTime.':00';
        }

        return $startTime;
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
