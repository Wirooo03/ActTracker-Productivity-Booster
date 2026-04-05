<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Activity extends Model
{
    use HasFactory;

    protected $table = 'activity';

    protected $primaryKey = 'activity_id';

    public $timestamps = false;

    protected $fillable = [
        'activity_date',
        'activity_point',
        'activity_description',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'activity_id' => 'integer',
            'activity_date' => 'date',
            'activity_point' => 'integer',
        ];
    }

    public function activityTags(): HasMany
    {
        return $this->hasMany(ActivityTag::class, 'activity_id', 'activity_id');
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'activity_tag', 'activity_id', 'tag_id')
            ->withPivot(['activity_tag_id', 'activity_tag_date', 'tag_value']);
    }
}
