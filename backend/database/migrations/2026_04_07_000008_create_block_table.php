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
        Schema::create('block', function (Blueprint $table) {
            $table->increments('block_id');
            $table->time('start_time');
            $table->string('duration', 16);
            $table->unsignedInteger('prev')->nullable();
            $table->unsignedInteger('next')->nullable();
            $table->string('activity_name');
            $table->date('date');

            $table->foreign('prev')
                ->references('block_id')
                ->on('block')
                ->nullOnDelete();

            $table->foreign('next')
                ->references('block_id')
                ->on('block')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('block');
    }
};
