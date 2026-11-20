<?php
/**
 * TEPA Performance Award 2026 — WP-Admin Settings & Live Command Center
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register WordPress Settings for Supabase credentials & Demo toggle.
 */
function tepa_register_settings() {
	register_setting(
		'tepa_award_settings',
		'tepa_supabase_url',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'esc_url_raw',
			'default'           => TEPA_DEFAULT_SUPABASE_URL,
		)
	);

	register_setting(
		'tepa_award_settings',
		'tepa_supabase_anon_key',
		array(
			'type'              => 'string',
			'sanitize_callback' => 'sanitize_text_field',
			'default'           => TEPA_DEFAULT_SUPABASE_KEY,
		)
	);

	register_setting(
		'tepa_award_settings',
		'tepa_force_demo',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => 'absint',
			'default'           => 0,
		)
	);
}
add_action( 'admin_init', 'tepa_register_settings' );

/**
 * Add top-level WP-Admin menu item and dedicated submenus.
 */
function tepa_add_admin_menu() {
	add_menu_page(
		'TEPA Award 2026 — Command Center',
		'TEPA Award 2026',
		'manage_options',
		'tepa-award-2026',
		'tepa_render_admin_page',
		'dashicons-awards',
		3
	);

	$submenus = array(
		array( 'slug' => 'tepa-award-2026',               'title' => 'Live Stage & Controls' ),
		array( 'slug' => 'tepa-award-2026&tab=questions',   'title' => 'Quiz Studio' ),
		array( 'slug' => 'tepa-award-2026&tab=projects',    'title' => 'Voting & Projects' ),
		array( 'slug' => 'tepa-award-2026&tab=submissions', 'title' => 'Winners & Desk' ),
		array( 'slug' => 'tepa-award-2026&tab=settings',    'title' => 'QR Kit & Connection' ),
		array( 'slug' => 'tepa-award-2026&tab=audit',       'title' => 'System Audit' ),
	);

	foreach ( $submenus as $sub ) {
		add_submenu_page(
			'tepa-award-2026',
			'TEPA 2026 — ' . $sub['title'],
			$sub['title'],
			'manage_options',
			$sub['slug'],
			'tepa_render_admin_page'
		);
	}
}
add_action( 'admin_menu', 'tepa_add_admin_menu' );

/**
 * Add immersive app-shell body class when viewing TEPA Backoffice inside WP-Admin.
 */
function tepa_admin_body_class( $classes ) {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen && false !== strpos( (string) $screen->id, 'tepa-award-2026' ) ) {
		$classes .= ' tepa-wp-admin-page tepa-wp-immersive ';
	}
	return $classes;
}
add_filter( 'admin_body_class', 'tepa_admin_body_class' );

/**
 * Render unified WP-Admin Command Center with embedded WP Settings form template.
 */
function tepa_render_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$raw_url      = trim( (string) get_option( 'tepa_supabase_url', '' ) );
	$raw_key      = trim( (string) get_option( 'tepa_supabase_anon_key', '' ) );
	$supabase_url = '' !== $raw_url ? $raw_url : TEPA_DEFAULT_SUPABASE_URL;
	$supabase_key = '' !== $raw_key ? $raw_key : TEPA_DEFAULT_SUPABASE_KEY;
	$force_demo   = (bool) get_option( 'tepa_force_demo', false );
	?>
	<div class="wrap tepa-wp-admin-wrap">
		<h1 class="screen-reader-text">TEPA Performance Award 2026 — Event Backoffice</h1>

		<?php settings_errors(); ?>

		<div id="tepa-admin-root" data-tepa-app="admin"></div>

		<template id="tepa-wp-settings-tpl">
			<form method="post" action="options.php" class="tepa-bo-wp-form">
				<?php settings_fields( 'tepa_award_settings' ); ?>

				<div class="tepa-bo-field">
					<label class="tepa-bo-label" for="tepa_supabase_url">Supabase Project URL</label>
					<input
						name="tepa_supabase_url"
						id="tepa_supabase_url"
						type="url"
						class="tepa-bo-input"
						value="<?php echo esc_attr( $supabase_url ); ?>"
						placeholder="https://your-project-ref.supabase.co"
					/>
					<div class="tepa-bo-hint">Connected cloud database &amp; Realtime engine (leave default for TEPA 2026 project <code>ujpzqulgainzxxombrgb</code>).</div>
				</div>

				<div class="tepa-bo-field">
					<label class="tepa-bo-label" for="tepa_supabase_anon_key">Supabase Publishable / Anon Key</label>
					<input
						name="tepa_supabase_anon_key"
						id="tepa_supabase_anon_key"
						type="text"
						class="tepa-bo-input"
						value="<?php echo esc_attr( $supabase_key ); ?>"
						placeholder="sb_publishable_..."
					/>
					<div class="tepa-bo-hint">Public client key safe for browser Realtime subscriptions and RPC calls.</div>
				</div>

				<div class="tepa-bo-gate-row">
					<div>
						<div class="tepa-bo-stage-title">Force Demo / Rehearsal Mode</div>
						<div class="tepa-bo-stage-desc">When ON, events run locally via browser BroadcastChannel without writing to Supabase Cloud. Keep OFF for live event day.</div>
					</div>
					<label class="tepa-bo-switch">
						<input class="tepa-bo-switch-input" name="tepa_force_demo" type="checkbox" value="1" <?php checked( $force_demo ); ?> />
						<span class="tepa-bo-switch-track"><span class="tepa-bo-switch-thumb"></span></span>
					</label>
				</div>

				<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:16px;">
					<button type="submit" class="tepa-bo-btn tepa-bo-btn-primary">Save Connection Settings</button>
				</div>
			</form>
		</template>
	</div>
	<?php
}
