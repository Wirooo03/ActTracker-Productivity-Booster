<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('expedition')
            ->select(['expedition_id', 'duration'])
            ->orderBy('expedition_id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    $normalizedDuration = $this->normalizeToHms((string) $row->duration);

                    if ($normalizedDuration !== null && $normalizedDuration !== $row->duration) {
                        DB::table('expedition')
                            ->where('expedition_id', $row->expedition_id)
                            ->update(['duration' => $normalizedDuration]);
                    }
                }
            }, 'expedition_id');

        DB::table('block')
            ->select(['block_id', 'duration'])
            ->orderBy('block_id')
            ->chunkById(100, function ($rows): void {
                foreach ($rows as $row) {
                    $normalizedDuration = $this->normalizeToHms((string) $row->duration);

                    if ($normalizedDuration !== null && $normalizedDuration !== $row->duration) {
                        DB::table('block')
                            ->where('block_id', $row->block_id)
                            ->update(['duration' => $normalizedDuration]);
                    }
                }
            }, 'block_id');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op: This migration only normalizes existing data to a stricter format.
    }

    private function normalizeToHms(string $duration): ?string
    {
        if (preg_match('/^(\d{1,3}):([0-5]\d)$/', $duration, $matches)) {
            return sprintf('%02d:%s:00', (int) $matches[1], $matches[2]);
        }

        if (preg_match('/^(\d{1,3}):([0-5]\d):([0-5]\d)$/', $duration, $matches)) {
            return sprintf('%02d:%s:%s', (int) $matches[1], $matches[2], $matches[3]);
        }

        return null;
    }
};
