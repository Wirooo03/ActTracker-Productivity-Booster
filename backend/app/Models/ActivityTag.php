<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityTag extends Model
{
    use HasFactory;

    protected $table = 'activity_tag';

    protected $primaryKey = 'activity_tag_id';

    public $timestamps = false;

    protected $fillable = [
        'activity_tag_date',
        'activity_id',
        'tag_id',
        'tag_value',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'activity_tag_id' => 'integer',
            'activity_tag_date' => 'date',
            'activity_id' => 'integer',
            'tag_id' => 'integer',
            'tag_value' => 'float',
        ];
    }

    public function activity(): BelongsTo
    {
        return $this->belongsTo(Activity::class, 'activity_id', 'activity_id');
    }

    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class, 'tag_id', 'tag_id');
    }
}
