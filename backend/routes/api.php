<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\ActivityTagController;
use App\Http\Controllers\ActionController;
use App\Http\Controllers\BlockController;
use App\Http\Controllers\ExpeditionController;
use App\Http\Controllers\TagController;
use Illuminate\Support\Facades\Route;

Route::prefix('activities')->group(function () {
    Route::get('/', [ActivityController::class, 'index']);
    Route::get('/date/{date}', [ActivityController::class, 'getByDate'])
        ->where('date', '\\d{4}-\\d{2}-\\d{2}');
    Route::get('/month/{year}/{month}', [ActivityController::class, 'getByMonthYear'])
        ->whereNumber('year')
        ->whereNumber('month');

    Route::get('/{activityId}', [ActivityController::class, 'show'])->whereNumber('activityId');
    Route::post('/', [ActivityController::class, 'store']);
    Route::put('/{activityId}', [ActivityController::class, 'update'])->whereNumber('activityId');
    Route::patch('/{activityId}', [ActivityController::class, 'update'])->whereNumber('activityId');
    Route::delete('/{activityId}', [ActivityController::class, 'destroy'])->whereNumber('activityId');
});

Route::prefix('tags')->group(function () {
    Route::get('/', [TagController::class, 'index']);
    Route::get('/{tagId}', [TagController::class, 'show'])->whereNumber('tagId');
    Route::post('/', [TagController::class, 'store']);
    Route::put('/{tagId}', [TagController::class, 'update'])->whereNumber('tagId');
    Route::patch('/{tagId}', [TagController::class, 'update'])->whereNumber('tagId');
    Route::delete('/{tagId}', [TagController::class, 'destroy'])->whereNumber('tagId');
});

Route::prefix('activity-tags')->group(function () {
    Route::get('/', [ActivityTagController::class, 'index']);
    Route::get('/{activityTagId}', [ActivityTagController::class, 'show'])->whereNumber('activityTagId');
    Route::post('/', [ActivityTagController::class, 'store']);
    Route::put('/{activityTagId}', [ActivityTagController::class, 'update'])->whereNumber('activityTagId');
    Route::patch('/{activityTagId}', [ActivityTagController::class, 'update'])->whereNumber('activityTagId');
    Route::delete('/{activityTagId}', [ActivityTagController::class, 'destroy'])->whereNumber('activityTagId');
});

Route::prefix('actions')->group(function () {
    Route::get('/', [ActionController::class, 'index']);
    Route::get('/{actionId}', [ActionController::class, 'show'])->whereNumber('actionId');
    Route::post('/', [ActionController::class, 'store']);
    Route::put('/{actionId}', [ActionController::class, 'update'])->whereNumber('actionId');
    Route::patch('/{actionId}', [ActionController::class, 'update'])->whereNumber('actionId');
    Route::delete('/{actionId}', [ActionController::class, 'destroy'])->whereNumber('actionId');
});

Route::prefix('expeditions')->group(function () {
    Route::get('/', [ExpeditionController::class, 'index']);
    Route::get('/{expeditionId}', [ExpeditionController::class, 'show'])->whereNumber('expeditionId');
    Route::post('/', [ExpeditionController::class, 'store']);
    Route::put('/{expeditionId}', [ExpeditionController::class, 'update'])->whereNumber('expeditionId');
    Route::patch('/{expeditionId}', [ExpeditionController::class, 'update'])->whereNumber('expeditionId');
    Route::delete('/{expeditionId}', [ExpeditionController::class, 'destroy'])->whereNumber('expeditionId');
});

Route::prefix('blocks')->group(function () {
    Route::get('/', [BlockController::class, 'index']);
    Route::get('/{blockId}', [BlockController::class, 'show'])->whereNumber('blockId');
    Route::post('/', [BlockController::class, 'store']);
    Route::put('/{blockId}', [BlockController::class, 'update'])->whereNumber('blockId');
    Route::patch('/{blockId}', [BlockController::class, 'update'])->whereNumber('blockId');
    Route::delete('/{blockId}', [BlockController::class, 'destroy'])->whereNumber('blockId');
});
