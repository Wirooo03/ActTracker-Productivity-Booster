<?php

namespace App\Http\Controllers;

use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index(): JsonResponse
    {
        $tags = Tag::query()
            ->orderBy('tag_name')
            ->orderBy('tag_id')
            ->get();

        return response()->json(['data' => $tags]);
    }

    public function show(int $tagId): JsonResponse
    {
        $tag = Tag::query()->find($tagId);

        if (! $tag) {
            return response()->json([
                'message' => 'Tag tidak ditemukan.',
            ], 404);
        }

        return response()->json(['data' => $tag]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tag_name' => ['required', 'string', 'max:255'],
        ]);

        $tag = Tag::query()->create($validated);

        return response()->json([
            'message' => 'Tag berhasil dibuat.',
            'data' => $tag,
        ], 201);
    }

    public function update(Request $request, int $tagId): JsonResponse
    {
        $tag = Tag::query()->find($tagId);

        if (! $tag) {
            return response()->json([
                'message' => 'Tag tidak ditemukan.',
            ], 404);
        }

        $validated = $request->validate([
            'tag_name' => ['sometimes', 'required', 'string', 'max:255'],
        ]);

        $tag->update($validated);

        return response()->json([
            'message' => 'Tag berhasil diperbarui.',
            'data' => $tag->fresh(),
        ]);
    }

    public function destroy(int $tagId): JsonResponse
    {
        $tag = Tag::query()->find($tagId);

        if (! $tag) {
            return response()->json([
                'message' => 'Tag tidak ditemukan.',
            ], 404);
        }

        $tag->delete();

        return response()->json([
            'message' => 'Tag berhasil dihapus.',
        ]);
    }
}
