<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Action extends Model
{
    use HasFactory;

    protected $table = 'action';

    protected $primaryKey = 'action_id';

    public $timestamps = false;

    protected $fillable = [
        'action_name',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'action_id' => 'integer',
        ];
    }

    public function expeditions(): HasMany
    {
        return $this->hasMany(Expedition::class, 'action_id', 'action_id');
    }
}
