<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Block extends Model
{
    use HasFactory;

    protected $table = 'block';

    protected $primaryKey = 'block_id';

    public $timestamps = false;

    protected $fillable = [
        'start_time',
        'duration',
        'prev',
        'next',
        'activity_name',
        'date',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'block_id' => 'integer',
            'prev' => 'integer',
            'next' => 'integer',
            'date' => 'date',
        ];
    }

    public function previousBlock(): BelongsTo
    {
        return $this->belongsTo(self::class, 'prev', 'block_id');
    }

    public function nextBlock(): BelongsTo
    {
        return $this->belongsTo(self::class, 'next', 'block_id');
    }
}
