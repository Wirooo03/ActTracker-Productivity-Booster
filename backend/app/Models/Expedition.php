<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expedition extends Model
{
    use HasFactory;

    protected $table = 'expedition';

    protected $primaryKey = 'expedition_id';

    public $timestamps = false;

    protected $fillable = [
        'action_id',
        'duration',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expedition_id' => 'integer',
            'action_id' => 'integer',
        ];
    }

    public function action(): BelongsTo
    {
        return $this->belongsTo(Action::class, 'action_id', 'action_id');
    }
}
