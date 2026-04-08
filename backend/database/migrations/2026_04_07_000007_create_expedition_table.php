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
        Schema::create('expedition', function (Blueprint $table) {
            $table->increments('expedition_id');
            $table->unsignedInteger('action_id');
            $table->string('duration', 16);

            $table->foreign('action_id')
                ->references('action_id')
                ->on('action')
                ->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expedition');
    }
};
