<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tag extends Model
{
    use HasFactory;

    protected $table = 'tag';

    protected $primaryKey = 'tag_id';

    public $timestamps = false;

    protected $fillable = [
        'tag_name',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'tag_id' => 'integer',
        ];
    }

    public function activityTags(): HasMany
    {
        return $this->hasMany(ActivityTag::class, 'tag_id', 'tag_id');
    }

    public function activities(): BelongsToMany
    {
        return $this->belongsToMany(Activity::class, 'activity_tag', 'tag_id', 'activity_id')
            ->withPivot(['activity_tag_id', 'activity_tag_date', 'tag_value']);
    }
}
