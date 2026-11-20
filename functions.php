<?php
/**
 * TEPA Performance Award 2026 ("Light Up") — Theme Functions & Setup
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'TEPA_THEME_VERSION', '1.8.18' );
define( 'TEPA_DEFAULT_SUPABASE_URL', 'https://ujpzqulgainzxxombrgb.supabase.co' );
define( 'TEPA_DEFAULT_SUPABASE_KEY', 'sb_publishable_cuReE7bA6g0vdzdJQCPWJQ_oPCuxzxM' );

add_filter( 'show_admin_bar', '__return_false' );

require_once get_template_directory() . '/inc/admin-settings.php';

/**
 * Enable theme supports.
 */
function tepa_theme_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'html5', array( 'style', 'script' ) );
}
add_action( 'after_setup_theme', 'tepa_theme_setup' );

/**
 * Resolve page URL for a given TEPA view slug, falling back to query-param route.
 */
function tepa_get_view_url( $slug ) {
	$page = get_page_by_path( $slug );
	if ( $page && 'publish' === $page->post_status ) {
		return get_permalink( $page->ID );
	}
	return add_query_arg( 'view', $slug, home_url( '/' ) );
}

/**
 * Build public runtime config passed to frontend JS.
 */
function tepa_get_runtime_config() {
	$raw_url      = trim( (string) get_option( 'tepa_supabase_url', '' ) );
	$raw_key      = trim( (string) get_option( 'tepa_supabase_anon_key', '' ) );
	$supabase_url = '' !== $raw_url ? $raw_url : TEPA_DEFAULT_SUPABASE_URL;
	$supabase_key = '' !== $raw_key ? $raw_key : TEPA_DEFAULT_SUPABASE_KEY;
	$force_demo   = (bool) get_option( 'tepa_force_demo', false );
	$is_wp_admin  = is_admin() && is_user_logged_in() && current_user_can( 'manage_options' );
	$current_user = $is_wp_admin ? wp_get_current_user() : null;
	$req_tab      = ( $is_wp_admin && isset( $_GET['tab'] ) ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';

	return array(
		'supabaseUrl'     => $supabase_url,
		'supabaseAnonKey' => $supabase_key,
		'forceDemo'       => $force_demo || ( empty( $supabase_url ) || empty( $supabase_key ) ),
		'rawForceDemo'    => $force_demo,
		'isWpAdmin'       => $is_wp_admin,
		'requireWpAdmin'  => true,
		'wpUserDisplay'   => $current_user ? $current_user->display_name : '',
		'wpDashboardUrl'  => admin_url( 'index.php' ),
		'wpAdminTab'      => $req_tab,
		'defaultPin'      => $is_wp_admin ? (string) get_option( 'tepa_admin_pin', '2026' ) : '',
		'assetsBase'      => get_template_directory_uri() . '/assets',
		'homeUrl'         => home_url( '/' ),
		'quizUrl'         => tepa_get_view_url( 'quiz' ),
		'voteUrl'         => tepa_get_view_url( 'vote' ),
		'liveUrl'         => tepa_get_view_url( 'live' ),
		'adminUrl'        => admin_url( 'admin.php?page=tepa-award-2026' ),
	);
}

function tepa_asset_ver( $rel_path ) {
	$full = get_template_directory() . '/' . ltrim( $rel_path, '/' );
	return file_exists( $full ) ? (string) filemtime( $full ) : TEPA_THEME_VERSION;
}

/**
 * Enqueue frontend styles & scripts.
 */
function tepa_enqueue_assets() {
	$theme_uri = get_template_directory_uri();

	wp_enqueue_style(
		'tepa-google-fonts',
		'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
		array(),
		null
	);

	wp_enqueue_style(
		'tepa-award-style',
		$theme_uri . '/assets/css/tepa.css',
		array( 'tepa-google-fonts' ),
		tepa_asset_ver( 'assets/css/tepa.css' )
	);

	wp_enqueue_script(
		'tepa-qrcode',
		$theme_uri . '/assets/js/qrcode.min.js',
		array(),
		tepa_asset_ver( 'assets/js/qrcode.min.js' ),
		true
	);

	wp_enqueue_script(
		'tepa-data',
		$theme_uri . '/assets/js/tepa-data.js',
		array( 'tepa-qrcode' ),
		tepa_asset_ver( 'assets/js/tepa-data.js' ),
		true
	);

	wp_localize_script( 'tepa-data', 'TEPA_CONFIG', tepa_get_runtime_config() );

	wp_enqueue_script(
		'tepa-app',
		$theme_uri . '/assets/js/tepa-app.js',
		array( 'tepa-data', 'tepa-qrcode' ),
		tepa_asset_ver( 'assets/js/tepa-app.js' ),
		true
	);
}
add_action( 'wp_enqueue_scripts', 'tepa_enqueue_assets' );

/**
 * Enqueue same assets inside the TEPA WP-Admin dashboard page.
 */
function tepa_enqueue_admin_assets( $hook_suffix ) {
	if ( false === strpos( (string) $hook_suffix, 'tepa-award-2026' ) ) {
		return;
	}
	tepa_enqueue_assets();
}
add_action( 'admin_enqueue_scripts', 'tepa_enqueue_admin_assets' );

/**
 * Automatically create Quiz, Vote, and Live pages on theme activation.
 */
function tepa_create_event_pages() {
	$pages = array(
		array(
			'slug'     => 'quiz',
			'title'    => 'TEPA Quiz',
			'template' => 'template-quiz.php',
		),
		array(
			'slug'     => 'vote',
			'title'    => 'TEPA Voting',
			'template' => 'template-vote.php',
		),
		array(
			'slug'     => 'live',
			'title'    => 'TEPA Live Results',
			'template' => 'template-live.php',
		),
	);

	foreach ( $pages as $item ) {
		$existing = get_page_by_path( $item['slug'] );
		if ( ! $existing ) {
			$page_id = wp_insert_post(
				array(
					'post_title'   => $item['title'],
					'post_name'    => $item['slug'],
					'post_status'  => 'publish',
					'post_type'    => 'page',
					'post_content' => '',
				)
			);
			if ( $page_id && ! is_wp_error( $page_id ) ) {
				update_post_meta( $page_id, '_wp_page_template', $item['template'] );
			}
		} else {
			update_post_meta( $existing->ID, '_wp_page_template', $item['template'] );
		}
	}

	flush_rewrite_rules();
}
add_action( 'after_switch_theme', 'tepa_create_event_pages' );
