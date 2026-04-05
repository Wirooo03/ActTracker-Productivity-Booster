<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('activity_tag', function (Blueprint $table) {
            $table->increments('activity_tag_id');
            $table->date('activity_tag_date');
            $table->unsignedInteger('activity_id');
            $table->unsignedInteger('tag_id');
            $table->float('tag_value')->nullable();

            $table->foreign('activity_id')
                ->references('activity_id')
                ->on('activity')
                ->cascadeOnDelete();

            $table->foreign('tag_id')
                ->references('tag_id')
                ->on('tag')
                ->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_tag');
    }
};
